import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/community';
import ShareButtons from '@/components/ShareButtons';
import NewsletterSignup from '@/components/NewsletterSignup';
import OutboundLink from '@/components/OutboundLink';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';

interface EventDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  external_url: string | null;
  source_handle: string | null;
  source_post_url: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  image_url: string | null;
  is_free: boolean;
  tags: string[] | null;
  status: string;
  city_id: string;
  cities: { slug: string; name: string } | null;
}

const EVENT_FIELDS =
  'id, slug, name, description, venue_name, venue_address, external_url, source_handle, source_post_url, start_date, end_date, start_time, end_time, image_url, is_free, tags, status, city_id, cities!inner(slug, name)';

/**
 * Fetch an event regardless of status.
 *
 * Previously this filtered to APPROVED/PENDING, so CANCELLED events 404'd. That
 * was actively harmful: as of 2026-08-20, 149 of 327 events are CANCELLED, and
 * GA4 showed three of the top-four organic search landing pages were exactly
 * these 404s — ~47 sessions/month landing on a dead end and bouncing in 4-8s,
 * against 31-45s on city pages.
 *
 * A 404 throws away the ranking and the visitor. We now render the page with an
 * honest "this event has ended/was cancelled" state plus live alternatives, and
 * mark it noindex once stale (see generateMetadata) so Google stops ranking it
 * while existing visitors still land somewhere useful.
 */
async function getEvent(slug: string): Promise<EventDetail | null> {
  const admin = getServiceClient();
  const { data } = await admin
    .from('events')
    .select(EVENT_FIELDS)
    .eq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as EventDetail) || null;
}

/** Live, upcoming events in the same city — the onward journey for a dead page. */
async function getAlternatives(cityId: string, excludeSlug: string) {
  const admin = getServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await admin
    .from('events')
    .select('slug, name, start_date, venue_name, is_free')
    .eq('city_id', cityId)
    .eq('status', 'APPROVED')
    .gte('start_date', today)
    .neq('slug', excludeSlug)
    .order('start_date', { ascending: true })
    .limit(4);
  return data || [];
}

/** Is this page dead — cancelled, rejected, or in the past? */
function eventState(event: EventDetail): 'live' | 'cancelled' | 'past' {
  const today = new Date().toISOString().split('T')[0];
  if (event.status === 'CANCELLED' || event.status === 'REJECTED') return 'cancelled';
  const end = event.end_date || event.start_date;
  if (end < today) return 'past';
  return 'live';
}

/** Days since the event ended — drives the noindex decision. */
function daysSinceEnded(event: EventDetail): number {
  const end = new Date((event.end_date || event.start_date) + 'T00:00:00').getTime();
  return Math.floor((Date.now() - end) / 86400000);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const event = await getEvent(params.slug);
  if (!event) return { title: 'Event' };
  const cityName = event.cities?.name || '';
  const state = eventState(event);
  const stale = state !== 'live' && daysSinceEnded(event) > 30;

  // Title leads with the event name, because that is what people actually type.
  // Search Console (2026-08-20) shows every top query is an event-name search:
  // "ekka dog show 2026" (924 impressions), "wuthering heights day sydney 2026"
  // (251), "dogs day out st ives" (91). Burying the name behind a status prefix
  // or trailing it with boilerplate costs us the match.
  //
  // Cancelled/past state moves to the END so the name still leads, but searchers
  // see the status before clicking rather than bouncing off a dead page.
  const suffix =
    state === 'cancelled' ? ' (Cancelled)' : state === 'past' ? ' (Past event)' : '';
  const title = `${event.name}${suffix} — ${cityName}`;
  const description =
    state !== 'live'
      ? `This event is no longer running. See what else is on for dogs in ${cityName}.`
      : event.description?.slice(0, 155) ||
        `Dog-friendly event in ${cityName}${event.venue_name ? ` at ${event.venue_name}` : ''} on ${event.start_date}.`;

  return {
    title,
    description,
    // Keep live and recently-ended events indexed — people still search for them
    // and the page now offers a real onward journey. Drop the long tail of dead
    // events out of the index rather than letting Google rank 404-equivalents.
    ...(stale && { robots: { index: false, follow: true } }),
    alternates: { canonical: `${BASE_URL}/events/${event.slug}` },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${BASE_URL}/events/${event.slug}`,
      images: [event.image_url || `${BASE_URL}/images/og-default.png`],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export default async function EventDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const event = await getEvent(params.slug);
  if (!event) notFound();

  const state = eventState(event);
  const alternatives =
    state === 'live' ? [] : await getAlternatives(event.city_id, event.slug);

  const city = event.cities;
  const handle = event.source_handle
    ? event.source_handle.startsWith('@')
      ? event.source_handle
      : `@${event.source_handle}`
    : null;
  const instagramUrl =
    event.source_post_url ||
    (handle ? `https://instagram.com/${handle.slice(1)}` : null);
  const isPast = event.start_date < new Date().toISOString().split('T')[0];
  const pageUrl = `${BASE_URL}/events/${event.slug}`;

  // Schema.org Event structured data — makes the board a citable reference
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: event.start_time
      ? `${event.start_date}T${event.start_time}`
      : event.start_date,
    ...(event.end_date && { endDate: event.end_date }),
    ...(event.description && { description: event.description }),
    ...(event.image_url && { image: [event.image_url] }),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus:
      state === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.venue_name || city?.name || 'TBA',
      ...(event.venue_address && {
        address: event.venue_address,
      }),
    },
    ...(event.is_free && { isAccessibleForFree: true }),
    ...(event.external_url && { url: event.external_url }),
    organizer: handle
      ? { '@type': 'Organization', name: handle, url: instagramUrl }
      : { '@type': 'Organization', name: 'Paw Cities', url: BASE_URL },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href={city ? `/events?city=${city.slug}` : '/events'}
          className="text-sm text-gray-500 hover:text-orange-600 transition-colors"
        >
          ← {city ? `${city.name} events` : 'All events'}
        </Link>

        {/*
          Dead-event banner. This page used to 404 for cancelled events, which
          sent the site's largest traffic channel into a wall — three of the top
          four organic landing pages were 404s bouncing in 4-8s. Now the visitor
          is told the truth immediately and routed to the city page, which holds
          attention for 31-45s.
        */}
        {state !== 'live' && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">
              {state === 'cancelled'
                ? 'This event was cancelled'
                : 'This event has already taken place'}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {city
                ? `It's no longer running, but there's plenty else on for dogs in ${city.name}.`
                : "It's no longer running, but there's plenty else on for dogs."}
            </p>
            {city && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/${city.slug}`}
                  className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
                >
                  Dog-friendly {city.name} →
                </Link>
                <Link
                  href={`/events?city=${city.slug}`}
                  className="inline-flex items-center rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  All {city.name} events
                </Link>
              </div>
            )}

            {alternatives.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Coming up instead
                </p>
                <ul className="mt-2 space-y-2">
                  {alternatives.map((alt) => (
                    <li key={alt.slug}>
                      <Link
                        href={`/events/${alt.slug}`}
                        className="group flex items-baseline justify-between gap-3 rounded-lg bg-white px-3 py-2 hover:bg-amber-100 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900 group-hover:text-orange-700">
                          {alt.name}
                          {alt.is_free && (
                            <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-800">
                              FREE
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {formatLongDate(alt.start_date)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {event.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.image_url} alt={event.name} className="w-full max-h-80 object-cover" />
          )}
          <div className="p-6 sm:p-8">
            {isPast && (
              <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                This event has passed —{' '}
                <Link href={city ? `/events?city=${city.slug}` : '/events'} className="underline font-medium">
                  see what&apos;s coming up
                </Link>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-2">
              {event.is_free && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  Free to attend
                </span>
              )}
              {(event.tags || []).slice(0, 4).map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>

            <div className="mt-4 space-y-2 text-gray-700">
              <p className="flex items-start gap-2">
                <span>🗓️</span>
                <span>
                  <strong>{formatLongDate(event.start_date)}</strong>
                  {event.end_date && event.end_date !== event.start_date
                    ? ` – ${formatLongDate(event.end_date)}`
                    : ''}
                  {event.start_time
                    ? ` · ${formatTime(event.start_time)}${event.end_time ? `–${formatTime(event.end_time)}` : ''}`
                    : ''}
                </span>
              </p>
              {event.venue_name && (
                <p className="flex items-start gap-2">
                  <span>📍</span>
                  <span>
                    <strong>{event.venue_name}</strong>
                    {event.venue_address ? (
                      <>
                        {' — '}
                        <OutboundLink
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${event.venue_name} ${event.venue_address}`
                          )}`}
                          eventSlug={event.slug}
                          eventId={event.id}
                          citySlug={city?.slug}
                          linkType="maps"
                          eventState={state}
                          className="text-orange-600 hover:underline"
                        >
                          {event.venue_address}
                        </OutboundLink>
                      </>
                    ) : city ? (
                      `, ${city.name}`
                    ) : null}
                  </span>
                </p>
              )}
              {city && (
                <p className="flex items-start gap-2">
                  <span>🏙️</span>
                  <Link href={`/${city.slug}`} className="text-orange-600 hover:underline">
                    More dog-friendly spots in {city.name}
                  </Link>
                </p>
              )}
            </div>

            {event.description && (
              <p className="mt-6 text-gray-600 whitespace-pre-line leading-relaxed">
                {event.description}
              </p>
            )}

            {/* Actionable contact — the reason this event board is trustworthy */}
            <div className="mt-8 flex flex-wrap gap-3">
              {/*
                These are the conversion. Paw Cities is a directory: the page
                highlights the event, then the visitor leaves for the organiser.
                That departure is the success signal, and it was unmeasured
                until now — a visitor who found exactly what they wanted looked
                identical to one who bounced.
              */}
              {event.external_url && (
                <OutboundLink
                  href={event.external_url}
                  eventSlug={event.slug}
                  eventId={event.id}
                  citySlug={city?.slug}
                  linkType="tickets"
                  eventState={state}
                  className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Event details & tickets ↗
                </OutboundLink>
              )}
              {instagramUrl && (
                <OutboundLink
                  href={instagramUrl}
                  eventSlug={event.slug}
                  eventId={event.id}
                  citySlug={city?.slug}
                  linkType="instagram"
                  eventState={state}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:border-orange-400 hover:text-orange-600 transition-colors"
                >
                  {handle || 'Instagram'} on Instagram ↗
                </OutboundLink>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">Share this event</p>
              <ShareButtons
                url={pageUrl}
                title={`${event.name} — dog-friendly event in ${city?.name || ''}`}
                description={event.description || undefined}
              />
            </div>
          </div>
        </div>

        {/*
          Email capture. Event pages are the site's biggest organic search entry
          point (62% of traffic is search; event pages dominate landing pages) and
          until now asked visitors for nothing — 823 content pages had produced 2
          organic signups. City is pre-filled from the event so the ask is specific.
        */}
        <div className="mt-8">
          <NewsletterSignup
            citySlug={city?.slug}
            source={`event_page:${event.slug}`}
            variant="banner"
            heading={
              city
                ? `Dog-friendly ${city.name} events, in your inbox`
                : 'Dog-friendly events, in your inbox'
            }
            subtext={
              city
                ? `We'll email you what's on for dogs in ${city.name}. No spam, unsubscribe anytime.`
                : "We'll email you what's on for dogs in your city."
            }
          />
        </div>

        <p className="text-center mt-6 text-sm text-gray-400">
          Know of another dog-friendly event?{' '}
          <Link href="/events/submit" className="text-orange-600 hover:underline">
            Add it here
          </Link>
        </p>
      </div>
    </div>
  );
}

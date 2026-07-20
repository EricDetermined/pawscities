import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/community';
import ShareButtons from '@/components/ShareButtons';

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
  cities: { slug: string; name: string } | null;
}

async function getEvent(slug: string): Promise<EventDetail | null> {
  const admin = getServiceClient();
  const { data } = await admin
    .from('events')
    .select(
      'id, slug, name, description, venue_name, venue_address, external_url, source_handle, source_post_url, start_date, end_date, start_time, end_time, image_url, is_free, tags, status, cities!inner(slug, name)'
    )
    .eq('slug', slug)
    .in('status', ['APPROVED', 'PENDING'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as EventDetail) || null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const event = await getEvent(params.slug);
  if (!event) return { title: 'Event | Paw Cities' };
  const cityName = event.cities?.name || '';
  const title = `${event.name} — ${cityName} | Paw Cities`;
  const description =
    event.description?.slice(0, 155) ||
    `Dog-friendly event in ${cityName}${event.venue_name ? ` at ${event.venue_name}` : ''} on ${event.start_date}.`;
  return {
    title,
    description,
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
    eventStatus: 'https://schema.org/EventScheduled',
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
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${event.venue_name} ${event.venue_address}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:underline"
                        >
                          {event.venue_address}
                        </a>
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
              {event.external_url && (
                <a
                  href={event.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Event details & tickets ↗
                </a>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:border-orange-400 hover:text-orange-600 transition-colors"
                >
                  {handle || 'Instagram'} on Instagram ↗
                </a>
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

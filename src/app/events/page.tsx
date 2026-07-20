import { Metadata } from 'next';
import Link from 'next/link';
import { getServiceClient } from '@/lib/community';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dog-Friendly Events | Paw Cities',
  description:
    'Upcoming dog-friendly events across Paw Cities — yappy hours, adoption days, pup socials, and more. Every event has a link, contact, or venue you can act on.',
};

interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  external_url: string | null;
  source_handle: string | null;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  is_free: boolean;
  tags: string[] | null;
  cities: { slug: string; name: string } | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { city?: string };
}) {
  const admin = getServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const citySlug = searchParams.city || '';

  const [{ data: cities }, eventsRes] = await Promise.all([
    admin.from('cities').select('slug, name').eq('is_active', true).order('name'),
    (() => {
      let q = admin
        .from('events')
        .select(
          'id, slug, name, description, venue_name, external_url, source_handle, start_date, start_time, image_url, is_free, tags, cities!inner(slug, name)'
        )
        .in('status', ['APPROVED', 'PENDING'])
        .or('external_url.not.is.null,source_handle.not.is.null,venue_name.not.is.null')
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(100);
      if (citySlug) q = q.eq('cities.slug', citySlug);
      return q;
    })(),
  ]);

  const events = (eventsRes.data || []) as unknown as EventRow[];
  const activeCityName = (cities || []).find(c => c.slug === citySlug)?.name;

  // Group by month for a scannable reference board
  const byMonth = new Map<string, EventRow[]>();
  for (const ev of events) {
    const key = new Date(ev.start_date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(ev);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Dog-Friendly Events 📅</h1>
          <p className="text-orange-50 max-w-2xl mx-auto">
            Yappy hours, pup socials, adoption days — every event comes with a link,
            contact, or venue so you can actually go.
          </p>
          <Link
            href="/events/submit"
            className="inline-block mt-6 px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
          >
            Submit an event
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* City filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/events"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !citySlug
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
            }`}
          >
            All cities
          </Link>
          {(cities || []).map(c => (
            <Link
              key={c.slug}
              href={`/events?city=${c.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                citySlug === c.slug
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <span className="text-5xl block mb-4">📅</span>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No upcoming events{activeCityName ? ` in ${activeCityName}` : ''} yet
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Know of a dog-friendly event? Add it and help the community find it.
            </p>
            <Link
              href="/events/submit"
              className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              Submit an event
            </Link>
          </div>
        ) : (
          Array.from(byMonth.entries()).map(([month, monthEvents]) => (
            <div key={month} className="mb-10">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                {month}
              </h2>
              <div className="space-y-3">
                {monthEvents.map(ev => (
                  <Link
                    key={ev.id}
                    href={`/events/${ev.slug}`}
                    className="flex items-stretch gap-4 bg-white rounded-2xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-md transition-all"
                  >
                    <div className="w-16 shrink-0 flex flex-col items-center justify-center bg-orange-50 rounded-xl py-2">
                      <span className="text-xs font-semibold text-orange-600 uppercase">
                        {new Date(ev.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-bold text-gray-900">
                        {new Date(ev.start_date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{ev.name}</h3>
                        {ev.is_free && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                            Free
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatDate(ev.start_date)}
                        {ev.start_time ? ` · ${formatTime(ev.start_time)}` : ''}
                        {ev.venue_name ? ` · ${ev.venue_name}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        📍 {ev.cities?.name}
                        {ev.source_handle ? ` · ${ev.source_handle.startsWith('@') ? ev.source_handle : '@' + ev.source_handle}` : ''}
                      </p>
                    </div>
                    {ev.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ev.image_url}
                        alt=""
                        className="w-20 h-20 rounded-xl object-cover shrink-0 self-center hidden sm:block"
                      />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

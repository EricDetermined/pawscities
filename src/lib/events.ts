import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { PawEvent } from '@/types';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Maps a database row to a PawEvent.
 */
function mapEvent(row: Record<string, unknown>): PawEvent {
  const city = row.cities as { slug: string; name: string } | null;
  return {
    id: row.id as string,
    slug: row.slug as string,
    citySlug: city?.slug || '',
    cityName: city?.name || '',
    name: row.name as string,
    description: row.description as string | null,
    venueName: row.venue_name as string | null,
    venueAddress: row.venue_address as string | null,
    externalUrl: row.external_url as string | null,
    startDate: row.start_date as string,
    endDate: row.end_date as string | null,
    startTime: row.start_time as string | null,
    endTime: row.end_time as string | null,
    timezone: row.timezone as string | null,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    imageUrl: row.image_url as string | null,
    tags: (row.tags as string[]) || [],
    sourceHandle: row.source_handle as string | null,
    sourcePostUrl: row.source_post_url as string | null,
    discoveryScore: (row.discovery_score as number) || 0,
    mentionedHandles: (row.mentioned_handles as string[]) || [],
    status: row.status as PawEvent['status'],
    source: row.source as PawEvent['source'],
    isFeatured: row.is_featured as boolean,
    isFree: row.is_free as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Get today's date string in YYYY-MM-DD format.
 * Used as the baseline for filtering out past events.
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Homepage events: cross-city showcase.
 * Returns a curated set of upcoming events across ALL cities.
 * - APPROVED + PENDING events with a venue name
 * - Only future events (start_date >= today)
 * - Sorted by date (soonest first) so the homepage always feels current
 * - City diversity: max 2 events per city initially, then fills remaining slots
 * - Featured badge still displays on featured events in the UI
 * - Limited to `limit` results (default 8)
 */
export async function getHomepageEvents(limit: number = 8): Promise<PawEvent[]> {
  const supabase = getSupabaseAdmin();
  const today = getToday();

  // Fetch more than needed so we can curate for city diversity
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      cities(slug, name)
    `)
    .in('status', ['APPROVED', 'PENDING'])
    .not('venue_name', 'is', null)
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Failed to fetch homepage events:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Curate for city diversity: pick up to 2 per city first, then fill remaining
  const maxPerCityFirstPass = 2;
  const cityCount: Record<string, number> = {};
  const selected: typeof data = [];
  const overflow: typeof data = [];

  for (const event of data) {
    const cityId = event.city_id || 'unknown';
    const count = cityCount[cityId] || 0;
    if (count < maxPerCityFirstPass) {
      selected.push(event);
      cityCount[cityId] = count + 1;
    } else {
      overflow.push(event);
    }
    if (selected.length >= limit) break;
  }

  // Fill remaining slots from overflow if needed
  if (selected.length < limit) {
    for (const event of overflow) {
      selected.push(event);
      if (selected.length >= limit) break;
    }
  }

  // Re-sort by date for display
  selected.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

  return selected.map(mapEvent);
}

/**
 * City events: full calendar for a specific city.
 * Returns all upcoming events for the given city slug.
 * - APPROVED + PENDING events with a venue name
 * - Only future events (start_date >= today)
 * - Ordered by date ascending
 * - Paginated with limit/offset
 * Note: external_url is NOT required — events from Instagram/manual
 * entry often lack URLs but are still valid.
 */
export async function getCityEvents(
  citySlug: string,
  options: { limit?: number; page?: number } = {}
): Promise<{ events: PawEvent[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const today = getToday();
  const limit = options.limit || 50;
  const page = options.page || 1;
  const offset = (page - 1) * limit;

  // Look up city ID
  const { data: city } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', citySlug)
    .single();

  if (!city) {
    return { events: [], total: 0 };
  }

  const { data, error, count } = await supabase
    .from('events')
    .select(`
      *,
      cities(slug, name)
    `, { count: 'exact' })
    .eq('city_id', city.id)
    .in('status', ['APPROVED', 'PENDING'])
    .not('venue_name', 'is', null)
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error(`Failed to fetch events for city ${citySlug}:`, error);
    return { events: [], total: 0 };
  }

  return {
    events: (data || []).map(mapEvent),
    total: count || 0,
  };
}

/**
 * Get a single event by city slug and event slug.
 * Includes past events (for direct links / SEO).
 * Shows APPROVED + PENDING events (so users can access event details via URL).
 */
export async function getEventBySlug(
  citySlug: string,
  eventSlug: string
): Promise<PawEvent | null> {
  const supabase = getSupabaseAdmin();

  const { data: city } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', citySlug)
    .single();

  if (!city) return null;

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      cities(slug, name)
    `)
    .eq('city_id', city.id)
    .eq('slug', eventSlug)
    .in('status', ['APPROVED', 'PENDING'])
    .single();

  if (error || !data) return null;
  return mapEvent(data);
}

/**
 * Count upcoming events per city.
 * Used for showing event count badges on the homepage city cards.
 * Includes both APPROVED and PENDING events with a venue name.
 * Note: external_url is NOT required — many manually-added events
 * from Instagram don't have one and should still count.
 */
export async function getEventCountsByCity(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();
  const today = getToday();

  const { data, error } = await supabase
    .from('events')
    .select(`
      city_id,
      cities(slug)
    `)
    .in('status', ['APPROVED', 'PENDING'])
    .not('venue_name', 'is', null)
    .gte('start_date', today);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data) {
    const city = row.cities as unknown as { slug: string } | null;
    if (city?.slug) {
      counts[city.slug] = (counts[city.slug] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Total count of upcoming events across ALL cities.
 * Used for the homepage hero stat counter.
 * More permissive than city-level counts — includes any APPROVED/PENDING
 * future event, even without venue_name (some events are TBD location).
 */
export async function getTotalUpcomingEventCount(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const today = getToday();

  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .in('status', ['APPROVED', 'PENDING'])
    .gte('start_date', today);

  if (error) {
    console.error('Failed to count upcoming events:', error);
    return 0;
  }
  return count || 0;
}

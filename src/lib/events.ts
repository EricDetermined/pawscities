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
 * Returns a small curated set of upcoming events across ALL cities.
 * - Only approved events
 * - Only future events (start_date >= today)
 * - Featured events first, then by date
 * - Limited to `limit` results (default 6)
 */
export async function getHomepageEvents(limit: number = 6): Promise<PawEvent[]> {
  const supabase = getSupabaseAdmin();
  const today = getToday();

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      cities(slug, name)
    `)
    .eq('status', 'APPROVED')
    .gte('start_date', today)
    .order('is_featured', { ascending: false })
    .order('start_date', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch homepage events:', error);
    return [];
  }

  return (data || []).map(mapEvent);
}

/**
 * City events: full calendar for a specific city.
 * Returns all upcoming approved events for the given city slug.
 * - Only approved events
 * - Only future events (start_date >= today)
 * - Ordered by date ascending
 * - Paginated with limit/offset
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
    .eq('status', 'APPROVED')
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
    .eq('status', 'APPROVED')
    .single();

  if (error || !data) return null;
  return mapEvent(data);
}

/**
 * Count upcoming events per city.
 * Used for showing event count badges on the homepage city cards.
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
    .eq('status', 'APPROVED')
    .gte('start_date', today);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data) {
    const city = row.cities as { slug: string } | null;
    if (city?.slug) {
      counts[city.slug] = (counts[city.slug] || 0) + 1;
    }
  }
  return counts;
}

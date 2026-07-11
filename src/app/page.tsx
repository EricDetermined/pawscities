import { CITIES } from '@/lib/cities-config';
import { getCityEstablishments } from '@/lib/data';
import { getHomepageEvents, getTotalUpcomingEventCount } from '@/lib/events';
import HomePageClient from './HomePageClient';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering since getCityEstablishments may access Supabase
export const dynamic = 'force-dynamic';

export interface CityStats {
  count: number;
  topRated: string | null;
  topRating: number;
  categories: Record<string, number>;
}

export default async function HomePage() {
  const cities = Object.values(CITIES);

  // Build rich stats per city from research data
  const cityStats: Record<string, CityStats> = {};
  try {
    await Promise.all(
      cities.map(async (city) => {
        const establishments = await getCityEstablishments(city.slug);
        const topPlace = establishments.reduce(
          (best, est) => (est.rating > best.rating ? est : best),
          { name: '', rating: 0 } as { name: string; rating: number }
        );
        const categories: Record<string, number> = {};
        establishments.forEach((est) => {
          const cat = est.categorySlug || 'other';
          categories[cat] = (categories[cat] || 0) + 1;
        });
        cityStats[city.slug] = {
          count: establishments.length,
          topRated: topPlace.name || null,
          topRating: topPlace.rating,
          categories,
        };
      })
    );
  } catch (e) {
    console.error('Failed to build city stats:', e);
  }

  // Override per-city counts with the REAL database inventory (source of truth).
  // The research JSON files undercount the live DB for older cities, so the homepage
  // totals should reflect the actual ACTIVE listings. Falls back to JSON counts on error.
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const [{ data: cityRows }, { data: estRows }] = await Promise.all([
      supabase.from('cities').select('id, slug'),
      supabase.from('establishments').select('city_id').eq('status', 'ACTIVE').limit(5000),
    ]);
    if (cityRows && estRows) {
      const idToSlug: Record<string, string> = Object.fromEntries(cityRows.map((c) => [c.id, c.slug]));
      const dbCounts: Record<string, number> = {};
      for (const e of estRows) {
        const slug = idToSlug[e.city_id as string];
        if (slug) dbCounts[slug] = (dbCounts[slug] || 0) + 1;
      }
      for (const slug of Object.keys(cityStats)) {
        if (dbCounts[slug] != null) cityStats[slug].count = dbCounts[slug];
      }
    }
  } catch (e) {
    console.error('Failed to apply DB count override (using JSON counts):', e);
  }

  // Fetch upcoming events for the homepage banner + total count for stats
  let homepageEvents: Awaited<ReturnType<typeof getHomepageEvents>> = [];
  let totalEventCount = 0;
  try {
    [homepageEvents, totalEventCount] = await Promise.all([
      getHomepageEvents(8),
      getTotalUpcomingEventCount(),
    ]);
  } catch (e) {
    console.error('Failed to fetch homepage events:', e);
  }

  return <HomePageClient cities={cities} cityStats={cityStats} events={homepageEvents} totalEventCount={totalEventCount} />;
}

import { CITIES } from '@/lib/cities-config';
import { getCityEstablishments } from '@/lib/data';
import { getHomepageEvents, getTotalUpcomingEventCount } from '@/lib/events';
import HomePageClient from './HomePageClient';

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

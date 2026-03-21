import { CITIES } from '@/lib/cities-config';
import { getCityEstablishments } from '@/lib/data';
import HomePageClient from './HomePageClient';

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

  return <HomePageClient cities={cities} cityStats={cityStats} />;
}

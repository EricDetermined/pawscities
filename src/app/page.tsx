import { CITIES } from '@/lib/cities-config';
import { createClient } from '@/lib/supabase/server';
import HomePageClient from './HomePageClient';

export default async function HomePage() {
  const cities = Object.values(CITIES);

  // Fetch place counts per city for the city cards
  let cityCounts: Record<string, number> = {};
  try {
    const supabase = await createClient();
    const { data: counts } = await supabase
      .from('establishments')
      .select('city_id')
      .eq('status', 'ACTIVE');

    // Look up city slugs from the cities table
    const { data: cityRows } = await supabase
      .from('cities')
      .select('id, slug');

    if (counts && cityRows) {
      const cityIdToSlug: Record<string, string> = {};
      cityRows.forEach((row: { id: string; slug: string }) => {
        cityIdToSlug[row.id] = row.slug;
      });

      const countMap: Record<string, number> = {};
      counts.forEach((est: { city_id: string }) => {
        const slug = cityIdToSlug[est.city_id];
        if (slug) {
          countMap[slug] = (countMap[slug] || 0) + 1;
        }
      });
      cityCounts = countMap;
    }
  } catch (e) {
    // Non-blocking — city cards will just show generic text
    console.error('Failed to fetch city counts:', e);
  }

  return <HomePageClient cities={cities} cityCounts={cityCounts} />;
}

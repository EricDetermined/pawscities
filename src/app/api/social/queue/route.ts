import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getRecentMedia } from '@/lib/instagram';
import { CONTENT_BANK, CITY_META, generateCaption } from '@/lib/social-content';

/**
 * GET /api/social/queue
 *
 * Admin-only endpoint that returns:
 * - Content bank overview (what's available to post)
 * - Recent Instagram posts (what's been published)
 * - Next suggested posts
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    // Get recent Instagram posts
    const recentResult = await getRecentMedia(25);
    const recentPosts = 'posts' in recentResult ? recentResult.posts : [];
    const recentError = 'error' in recentResult ? recentResult.error : null;

    // Map content bank by city
    const contentByCity: Record<string, Array<{ headline: string; body: string; type: string }>> = {};
    for (const fact of CONTENT_BANK) {
      const cityName = CITY_META[fact.city]?.name || fact.city;
      if (!contentByCity[cityName]) contentByCity[cityName] = [];
      contentByCity[cityName].push({
        headline: fact.headline,
        body: fact.body,
        type: fact.type,
      });
    }

    // Preview next 5 captions that would be auto-posted
    const postedHeadlines = new Set<string>(); // In production, this would come from a DB
    const upcomingPosts = [];
    const usedHeadlines = new Set<string>();

    for (let i = 0; i < 5; i++) {
      const combinedHeadlines = new Set([...postedHeadlines, ...usedHeadlines]);
      const cityPostCounts: Record<string, number> = {};
      const rotation = ['barcelona', 'tokyo', 'paris', 'nyc', 'geneva', 'london', 'losangeles', 'sydney'];

      for (const city of rotation) {
        cityPostCounts[city] = 0;
      }
      for (const fact of CONTENT_BANK) {
        if (combinedHeadlines.has(fact.headline)) {
          cityPostCounts[fact.city] = (cityPostCounts[fact.city] || 0) + 1;
        }
      }

      const sortedCities = [...rotation].sort(
        (a, b) => (cityPostCounts[a] || 0) - (cityPostCounts[b] || 0)
      );

      let picked = false;
      for (const city of sortedCities) {
        const available = CONTENT_BANK.filter(
          f => f.city === city && !combinedHeadlines.has(f.headline)
        );
        if (available.length > 0) {
          const fact = available[0];
          usedHeadlines.add(fact.headline);
          upcomingPosts.push({
            city: CITY_META[fact.city]?.name || fact.city,
            headline: fact.headline,
            preview: fact.body.substring(0, 100) + (fact.body.length > 100 ? '...' : ''),
            caption: generateCaption(fact),
          });
          picked = true;
          break;
        }
      }
      if (!picked) break;
    }

    return NextResponse.json({
      contentBank: {
        totalFacts: CONTENT_BANK.length,
        byCityCount: Object.fromEntries(
          Object.entries(contentByCity).map(([city, facts]) => [city, facts.length])
        ),
      },
      recentInstagramPosts: recentPosts.map((p: Record<string, unknown>) => ({
        id: p.id,
        caption: typeof p.caption === 'string' ? p.caption.substring(0, 120) + '...' : '',
        timestamp: p.timestamp,
        permalink: p.permalink,
      })),
      recentError,
      upcomingPosts,
    });
  } catch (error) {
    console.error('Social queue error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

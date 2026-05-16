import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getCronSecret() { return process.env.CRON_SECRET; }
function getMetaToken() { return process.env.META_PAGE_ACCESS_TOKEN; }
function getInstagramAccountId() { return process.env.INSTAGRAM_ACCOUNT_ID; }
function getMetaApiVersion() { return process.env.META_API_VERSION || 'v21.0'; }

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 120;

// ─── Event-specific hashtags per city ────────────────────────────────────────
// Rotated weekly — 4 hashtags per run to stay within API limits

const EVENT_HASHTAGS: Record<string, string[]> = {
  paris: ['dogfriendlyparis', 'chienaparis', 'parisdogs', 'pariscanin'],
  london: ['dogfriendlylondon', 'londondogs', 'dogwalkslondon', 'dogeventlondon'],
  barcelona: ['dogfriendlybarcelona', 'barcelonadogs', 'perrobarcelona'],
  losangeles: ['dogfriendlyla', 'ladogs', 'dogeventsla', 'dogfriendlypasadena'],
  nyc: ['dogfriendlynyc', 'nycdogs', 'dogeventsnyc', 'brooklyndogs'],
  sydney: ['dogfriendlysydney', 'sydneydogs', 'dogeventssydney'],
  tokyo: ['dogfriendlytokyo', 'tokyodogs'],
  geneva: ['dogfriendlygeneva', 'genevedogs'],
};

const GLOBAL_EVENT_HASHTAGS = [
  'dogevent', 'dogfestival', 'dogmeetup', 'dogwalk',
  'dogadoption', 'dogrescueevent', 'petadoption',
  'dogfriendlyevent',
];

// ─── Event classification ────────────────────────────────────────────────────

const EVENT_KEYWORDS = [
  'event', 'festival', 'parade', 'walk', 'meetup', 'adoption', 'fundraiser',
  'brunch', 'yappy hour', 'happy hour', 'pop-up', 'popup', 'market',
  'competition', 'show', 'race', 'run', 'hike', 'gathering',
  'workshop', 'class', 'training', 'seminar', 'fair', 'fête', 'fete',
  'save the date', 'join us', 'register now', 'tickets', 'rsvp',
  'this weekend', 'this saturday', 'this sunday', 'next week',
  'coming soon', 'mark your calendar', 'don\'t miss',
];

const VENUE_KEYWORDS = [
  'park', 'beach', 'garden', 'plaza', 'square', 'hotel', 'restaurant',
  'café', 'cafe', 'bar', 'brewery', 'winery', 'rooftop',
];

interface MediaItem {
  id: string;
  caption?: string;
  media_type: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  username?: string;
}

function classifyEventRelevance(caption: string, likeCount: number): number {
  const lower = (caption || '').toLowerCase();
  let score = 0;

  // Event keywords (strong signal)
  const eventMatches = EVENT_KEYWORDS.filter(kw => lower.includes(kw));
  score += eventMatches.length * 12;

  // Venue keywords (moderate signal)
  const venueMatches = VENUE_KEYWORDS.filter(kw => lower.includes(kw));
  score += venueMatches.length * 5;

  // Date references (strong signal — events have dates)
  if (/\b\d{1,2}[\/\-\.]\d{1,2}\b/.test(lower)) score += 15;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i.test(lower)) score += 15;
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower)) score += 8;

  // Engagement boost (popular posts more likely to be real events)
  if (likeCount > 100) score += 5;
  if (likeCount > 500) score += 10;
  if (likeCount > 1000) score += 15;

  // Mentions (events often tag locations/partners)
  const mentions = (lower.match(/@\w+/g) || []).length;
  score += Math.min(mentions * 3, 12);

  // Emoji signals
  if (/📅|🗓|📆|🎉|🎊|🐕|🐶|🎪/.test(caption || '')) score += 5;

  return Math.min(score, 100);
}

function detectCity(caption: string): string | null {
  const lower = (caption || '').toLowerCase();
  const cityMap: Record<string, string[]> = {
    paris: ['paris', 'parisien'],
    london: ['london'],
    barcelona: ['barcelona', 'bcn'],
    losangeles: ['los angeles', 'la ', 'pasadena', 'hollywood', 'santa monica'],
    nyc: ['new york', 'nyc', 'brooklyn', 'manhattan'],
    sydney: ['sydney'],
    tokyo: ['tokyo'],
    geneva: ['geneva', 'genève', 'geneve'],
  };

  for (const [city, keywords] of Object.entries(cityMap)) {
    if (keywords.some(kw => lower.includes(kw))) return city;
  }
  return null;
}

/**
 * Weekly Event Discovery Cron
 *
 * Uses Instagram Graph API hashtag search (same as social-outreach)
 * to find event-related posts, classify them, and insert into the
 * events table for admin review.
 *
 * Runs weekly on Mondays at 8 AM UTC.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== getCronSecret()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const META_PAGE_ACCESS_TOKEN = getMetaToken();
  const INSTAGRAM_ACCOUNT_ID = getInstagramAccountId();
  const META_API_VERSION = getMetaApiVersion();

  if (!META_PAGE_ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
    console.error('[EVENT-DISCOVERY] Instagram API credentials not configured');
    return NextResponse.json({ error: 'Instagram API not configured' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  // Smart rotation: ALWAYS 2 global + 2 city-specific hashtags per run
  // This guarantees city-level event discovery every week
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

  // Pick 2 global hashtags (rotate through 8)
  const globalStart = (weekNumber * 2) % GLOBAL_EVENT_HASHTAGS.length;
  const selectedGlobal = [
    GLOBAL_EVENT_HASHTAGS[globalStart % GLOBAL_EVENT_HASHTAGS.length],
    GLOBAL_EVENT_HASHTAGS[(globalStart + 1) % GLOBAL_EVENT_HASHTAGS.length],
  ];

  // Pick 2 city-specific hashtags (rotate through cities, pick 1 hashtag each from 2 cities)
  const cities = Object.keys(EVENT_HASHTAGS);
  const cityIdx1 = weekNumber % cities.length;
  const cityIdx2 = (weekNumber + 1) % cities.length;
  const city1Tags = EVENT_HASHTAGS[cities[cityIdx1]];
  const city2Tags = EVENT_HASHTAGS[cities[cityIdx2]];
  const selectedCity = [
    city1Tags[weekNumber % city1Tags.length],
    city2Tags[weekNumber % city2Tags.length],
  ];

  const selectedHashtags = [...selectedGlobal, ...selectedCity];
  const targetCities = [cities[cityIdx1], cities[cityIdx2]];

  console.log(`[EVENT-DISCOVERY] Scanning: ${selectedHashtags.join(', ')} (targeting ${targetCities.join(', ')})`);

  const discoveredEvents: Array<{
    caption: string;
    permalink: string;
    username: string;
    city: string | null;
    score: number;
    likes: number;
    hashtag: string;
  }> = [];

  // Search each hashtag
  for (const hashtag of selectedHashtags) {
    try {
      // Step 1: Get hashtag ID
      const searchUrl = `https://graph.facebook.com/${META_API_VERSION}/ig_hashtag_search?q=${hashtag}&user_id=${INSTAGRAM_ACCOUNT_ID}&access_token=${META_PAGE_ACCESS_TOKEN}`;
      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
      const searchData = await searchRes.json();

      if (!searchData.data?.[0]?.id) {
        console.warn(`[EVENT-DISCOVERY] No hashtag ID for #${hashtag}`);
        continue;
      }

      const hashtagId = searchData.data[0].id;

      // Step 2: Get recent media for this hashtag
      const mediaUrl = `https://graph.facebook.com/${META_API_VERSION}/${hashtagId}/recent_media?user_id=${INSTAGRAM_ACCOUNT_ID}&fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=25&access_token=${META_PAGE_ACCESS_TOKEN}`;
      const mediaRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(15000) });
      const mediaData = await mediaRes.json();

      if (!mediaData.data) {
        console.warn(`[EVENT-DISCOVERY] No media for #${hashtag}: ${JSON.stringify(mediaData.error || {})}`);
        continue;
      }

      // Step 3: Classify each post for event relevance
      for (const post of mediaData.data as MediaItem[]) {
        const score = classifyEventRelevance(post.caption || '', post.like_count || 0);
        if (score < 20) continue; // Skip low-relevance posts

        // Extract username from permalink (instagram.com/username/p/...)
        const usernameMatch = post.permalink?.match(/instagram\.com\/([^\/]+)\//);
        const username = usernameMatch?.[1] || 'unknown';

        const city = detectCity(post.caption || '') || detectCityFromHashtag(hashtag);

        discoveredEvents.push({
          caption: (post.caption || '').substring(0, 500),
          permalink: post.permalink,
          username,
          city,
          score,
          likes: post.like_count || 0,
          hashtag,
        });
      }

      console.log(`[EVENT-DISCOVERY] #${hashtag}: ${mediaData.data.length} posts scanned`);
    } catch (err) {
      console.error(`[EVENT-DISCOVERY] Error scanning #${hashtag}:`, err);
    }
  }

  // Sort by score descending, take top 20
  discoveredEvents.sort((a, b) => b.score - a.score);
  const topEvents = discoveredEvents.slice(0, 20);

  // Insert into ingest_queue for admin review (not directly into events table)
  let inserted = 0;
  for (const event of topEvents) {
    try {
      // Check for duplicates by permalink
      const { data: existing } = await supabase
        .from('ingest_queue')
        .select('id')
        .eq('url', event.permalink)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('ingest_queue').insert({
        source: 'event_discovery',
        submitted_by: 'cron:event-discovery',
        url: event.permalink,
        raw_text: event.caption,
        subject: `Event candidate (score: ${event.score}) from #${event.hashtag}`,
        platform: 'instagram',
        content_type: 'post',
        instagram_username: event.username,
        classification: 'event',
        city: event.city,
        priority: event.score >= 50 ? 'high' : 'normal',
        status: 'pending',
      });
      inserted++;
    } catch (err) {
      console.error(`[EVENT-DISCOVERY] Insert error for ${event.permalink}:`, err);
    }
  }

  const summary = `Scanned ${selectedHashtags.length} hashtags, found ${discoveredEvents.length} event candidates (score >= 20), inserted ${inserted} new items`;
  console.log(`[EVENT-DISCOVERY] ${summary}`);

  return NextResponse.json({
    success: true,
    hashtagsScanned: selectedHashtags,
    totalCandidates: discoveredEvents.length,
    inserted,
    topEvents: topEvents.slice(0, 5).map(e => ({
      permalink: e.permalink,
      score: e.score,
      city: e.city,
      hashtag: e.hashtag,
    })),
    summary,
  });
}

// Helper to infer city from hashtag name
function detectCityFromHashtag(hashtag: string): string | null {
  const lower = hashtag.toLowerCase();
  if (lower.includes('paris')) return 'paris';
  if (lower.includes('london')) return 'london';
  if (lower.includes('barcelona')) return 'barcelona';
  if (lower.includes('la') || lower.includes('losangeles') || lower.includes('pasadena')) return 'losangeles';
  if (lower.includes('nyc') || lower.includes('newyork') || lower.includes('brooklyn')) return 'nyc';
  if (lower.includes('sydney')) return 'sydney';
  if (lower.includes('tokyo')) return 'tokyo';
  if (lower.includes('geneva') || lower.includes('geneve')) return 'geneva';
  return null;
}

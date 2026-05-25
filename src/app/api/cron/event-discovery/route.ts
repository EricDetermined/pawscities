import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
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

// ─── City-specific hashtags (expanded for deeper discovery) ─────────────────
// Each city has 8-12 hashtags covering: events, venues, community handles, local dog culture
// The cron rotates through these daily so every city gets scanned every day

const CITY_HASHTAGS: Record<string, { slug: string; name: string; hashtags: string[] }> = {
  losangeles: {
    slug: 'losangeles',
    name: 'Los Angeles',
    hashtags: [
      'dogfriendlyla', 'ladogevents', 'dogsofla', 'dogfriendlysocal',
      'ladogpark', 'ladog', 'losangelesdogs', 'socaldogs',
      'dogfriendlypasadena', 'dogdayla', 'dodgersdognight', 'barkinthparkla',
      'pupupevent', 'yappyhourla', 'dogbrunchla', 'doghikela',
    ],
  },
  nyc: {
    slug: 'newyork',
    name: 'New York',
    hashtags: [
      'dogfriendlynyc', 'nycdogevents', 'dogsofnyc', 'nycdog',
      'brooklyndogs', 'dogfriendlybrooklyn', 'nycdogpark', 'nycpuppy',
      'centralparkdogs', 'pupsinthepark', 'nycdogwalk', 'barkinthparknyc',
      'dogbrunchnyc', 'dogeventnyc', 'dogfriendlymanhattan', 'nycrescuedogs',
    ],
  },
  london: {
    slug: 'london',
    name: 'London',
    hashtags: [
      'dogfriendlylondon', 'londondogs', 'londondogevents', 'dogfriendlyuk',
      'dogsofldn', 'londonpuppy', 'dogfestuk', 'dogshowuk',
      'londondogwalk', 'dogfriendlypub', 'dogbrunchlondon', 'discoverdogs',
      'londog', 'dogfriendlycafe', 'puppyyogalondon', 'dogadoptionuk',
    ],
  },
  paris: {
    slug: 'paris',
    name: 'Paris',
    hashtags: [
      'chienparis', 'dogfriendlyparis', 'parisdogs', 'chienaparis',
      'chienstagram', 'canidays', 'pariscanin', 'evenementchien',
      'chienfriendly', 'chiendeparis', 'promenadechien', 'expositioncanine',
      'baladecanine', 'dogsofparis', 'parispetfriendly', 'chieniledefrance',
    ],
  },
  barcelona: {
    slug: 'barcelona',
    name: 'Barcelona',
    hashtags: [
      'dogfriendlybarcelona', 'perrobarcelona', 'barcelonadogs', 'perrosdebarcelona',
      'eventosperros', 'perrosfriendly', 'dogbarcelona', 'mascotabarcelona',
      'eventocanino', 'concursocanino', 'perrosfelices', 'bcndogs',
      'playaperros', 'dogsofbcn', 'adogtabarcelona', 'perroplayabarcelona',
    ],
  },
  tokyo: {
    slug: 'tokyo',
    name: 'Tokyo',
    hashtags: [
      'dogfriendlytokyo', 'tokyodogs', 'ドッグイベント', 'わんこイベント',
      'わんこフェスタ', 'ドッグフェス', 'ドッグラン東京', '犬イベント東京',
      '犬のイベント', 'sippofesta', '東京犬', 'ワンコイベント',
      '犬カフェ東京', 'dogeventtokyo', '犬連れ東京', 'いぬすたぐらむ',
    ],
  },
  sydney: {
    slug: 'sydney',
    name: 'Sydney',
    hashtags: [
      'dogfriendlysydney', 'sydneydogs', 'dogeventssydney', 'dogsofstdney',
      'sydneydogwalk', 'dogfriendlyaus', 'sydneypups', 'dogfriendlycafe',
      'dogdaysydney', 'sydneydogpark', 'puppyyogasydney', 'dogsofbondi',
      'sydneydogbeach', 'dogfriendlynsw', 'australiadogs', 'ausdog',
    ],
  },
  geneva: {
    slug: 'geneva',
    name: 'Geneva',
    hashtags: [
      'dogfriendlygeneva', 'genevedogs', 'chienssuisses', 'swissdogs',
      'dogfriendlyswiss', 'worlddogshow', 'dogshowgeneva', 'chienfriendlygeneve',
      'hundevent', 'hundeschau', 'expositioncanine', 'swissdogevents',
      'genevadogwalk', 'hundeschweiz', 'lakegenevadogs', 'suissechien',
    ],
  },
};

const GLOBAL_EVENT_HASHTAGS = [
  'dogevent', 'dogfestival', 'dogmeetup', 'dogwalk',
  'dogadoption', 'dogrescueevent', 'petadoption',
  'dogfriendlyevent', 'barkinthpark', 'pupupevent',
  'yappyhour', 'dogbrunch', 'dogfriendlyvenue',
  'dogsofinstagram', 'petfriendlyevent',
];

// ─── Event classification (expanded) ────────────────────────────────────────

const EVENT_KEYWORDS = [
  // English
  'event', 'festival', 'parade', 'walk', 'meetup', 'adoption', 'fundraiser',
  'brunch', 'yappy hour', 'happy hour', 'pop-up', 'popup', 'pup up', 'market',
  'competition', 'show', 'race', 'run', 'hike', 'gathering', 'expo',
  'workshop', 'class', 'training', 'seminar', 'fair', 'fête', 'fete',
  'save the date', 'join us', 'register now', 'tickets', 'rsvp',
  'this weekend', 'this saturday', 'this sunday', 'next week',
  'coming soon', 'mark your calendar', 'don\'t miss', 'sign up',
  'dog day', 'pup night', 'bark in the park', 'pack walk',
  'free entry', 'open to all', 'bring your dog', 'dog friendly',
  'charity', 'benefit', 'gala', 'auction', 'raffle',
  'grand opening', 'launch party', 'ribbon cutting',
  // French
  'événement', 'exposition', 'concours', 'balade', 'promenade', 'foire',
  'inscrivez', 'rejoignez', 'gratuit', 'ouvert à tous',
  // Spanish
  'evento', 'concurso', 'feria', 'paseo', 'encuentro', 'inscripción',
  'entrada libre', 'abierto a todos',
  // Japanese
  'イベント', 'フェスタ', 'フェス', 'カーニバル', '開催', '参加', '募集',
  // German
  'veranstaltung', 'ausstellung', 'hundeschau', 'anmeldung',
];

const VENUE_KEYWORDS = [
  'park', 'beach', 'garden', 'plaza', 'square', 'hotel', 'restaurant',
  'café', 'cafe', 'bar', 'brewery', 'winery', 'rooftop', 'stadium',
  'arena', 'pier', 'boardwalk', 'shelter', 'rescue', 'sanctuary',
  'pet store', 'pet shop', 'groomer', 'vet', 'veterinary', 'clinic',
  'doggy daycare', 'dog run', 'dog park',
];

// Business/organization keywords — these indicate the post is from or about a business
const BUSINESS_KEYWORDS = [
  'grand opening', 'now open', 'we are open', 'come visit', 'stop by',
  'book now', 'reservations', 'appointments', 'treat your pup',
  'dog menu', 'pup cup', 'doggy menu', 'pet menu',
  'grooming', 'boarding', 'daycare', 'training classes',
  'adoption event', 'foster', 'rescue', 'shelter',
  'dog bakery', 'dog treats', 'pet boutique', 'pet supplies',
  'dog walking', 'pet sitting', 'dog photography',
  'sponsored by', 'presented by', 'hosted by', 'in partnership with',
  'thank you to our sponsors', 'thanks to', 'shoutout to',
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
  score += Math.min(eventMatches.length * 10, 40);

  // Venue keywords (moderate signal)
  const venueMatches = VENUE_KEYWORDS.filter(kw => lower.includes(kw));
  score += Math.min(venueMatches.length * 5, 15);

  // Business keywords (strong signal — these are businesses we want to engage with)
  const bizMatches = BUSINESS_KEYWORDS.filter(kw => lower.includes(kw));
  score += Math.min(bizMatches.length * 8, 24);

  // Date references (strong signal — events have dates)
  if (/\b\d{1,2}[\/\-\.]\d{1,2}\b/.test(lower)) score += 12;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i.test(lower)) score += 15;
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower)) score += 8;
  // French dates
  if (/\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(lower)) score += 12;
  // Japanese dates
  if (/\d{4}年\d{1,2}月\d{1,2}日/.test(caption || '')) score += 12;
  if (/\d{1,2}月\d{1,2}日/.test(caption || '')) score += 12;

  // Engagement boost
  if (likeCount > 100) score += 5;
  if (likeCount > 500) score += 10;
  if (likeCount > 1000) score += 15;

  // @ mentions (events often tag locations/partners/sponsors)
  const mentions = (lower.match(/@\w+/g) || []);
  score += Math.min(mentions.length * 4, 16);

  // Emoji signals (event-related emojis)
  if (/📅|🗓|📆|🎉|🎊|🐕|🐶|🎪|🎟|🏆|🥇|🎵|🍻|🥂/.test(caption || '')) score += 5;

  return Math.min(score, 100);
}

/** Extract @handles from caption text — these are potential business/sponsor handles */
function extractMentionedHandles(caption: string): string[] {
  const matches = (caption || '').match(/@([a-zA-Z0-9_.]{1,30})/g) || [];
  return matches
    .map(m => m.replace('@', ''))
    .filter(h => !['thepawcities', 'instagram', 'facebook'].includes(h.toLowerCase()));
}

/** Detect if a post is from a business (vs individual dog owner) */
function isBusinessPost(caption: string, username: string): boolean {
  const lower = (caption || '').toLowerCase();
  const bizSignals = BUSINESS_KEYWORDS.filter(kw => lower.includes(kw));
  // Username patterns that suggest business accounts
  const bizUsernamePatterns = [
    /pet|paw|dog|pup|woof|bark|canine|groomer|vet|rescue|shelter|kennel|daycare|treat|bakery|boutique/i,
  ];
  const isBizUsername = bizUsernamePatterns.some(p => p.test(username));
  return bizSignals.length >= 2 || (bizSignals.length >= 1 && isBizUsername);
}

function detectCity(caption: string): string | null {
  const lower = (caption || '').toLowerCase();
  const cityMap: Record<string, string[]> = {
    paris: ['paris', 'parisien', 'île-de-france', 'ile de france'],
    london: ['london', 'hackney', 'shoreditch', 'camden', 'islington', 'brixton'],
    barcelona: ['barcelona', 'bcn', 'barceloneta'],
    losangeles: ['los angeles', 'la ', 'pasadena', 'hollywood', 'santa monica', 'west hollywood',
      'silver lake', 'echo park', 'venice beach', 'huntington beach', 'long beach', 'burbank',
      'glendale', 'culver city', 'dtla', 'downtown la'],
    nyc: ['new york', 'nyc', 'brooklyn', 'manhattan', 'queens', 'bronx', 'east village',
      'west village', 'williamsburg', 'bushwick', 'astoria', 'upper west side', 'upper east side'],
    sydney: ['sydney', 'bondi', 'manly', 'newtown', 'surry hills', 'darling harbour',
      'circular quay', 'coogee', 'randwick'],
    tokyo: ['tokyo', '東京', 'shibuya', '渋谷', 'shinjuku', '新宿', 'yoyogi', '代々木',
      'roppongi', '六本木', 'akihabara', '秋葉原', 'ikebukuro', '池袋'],
    geneva: ['geneva', 'genève', 'geneve', 'lac léman', 'lac leman', 'lausanne'],
  };

  for (const [city, keywords] of Object.entries(cityMap)) {
    if (keywords.some(kw => lower.includes(kw))) return city;
  }
  return null;
}

function detectCityFromHashtag(hashtag: string): string | null {
  const lower = hashtag.toLowerCase();
  // Check each city's hashtag list
  for (const [cityKey, cityData] of Object.entries(CITY_HASHTAGS)) {
    if (cityData.hashtags.some(h => lower.includes(h) || h.includes(lower))) {
      return cityKey;
    }
  }
  // Fallback pattern matching
  if (lower.includes('paris') || lower.includes('chien')) return 'paris';
  if (lower.includes('london') || lower.includes('ldn')) return 'london';
  if (lower.includes('barcelona') || lower.includes('bcn') || lower.includes('perro')) return 'barcelona';
  if (lower.includes('la') || lower.includes('losangeles') || lower.includes('socal') || lower.includes('pasadena')) return 'losangeles';
  if (lower.includes('nyc') || lower.includes('newyork') || lower.includes('brooklyn')) return 'nyc';
  if (lower.includes('sydney') || lower.includes('bondi') || lower.includes('nsw')) return 'sydney';
  if (lower.includes('tokyo') || lower.includes('東京') || lower.includes('ドッグ') || lower.includes('わんこ')) return 'tokyo';
  if (lower.includes('geneva') || lower.includes('geneve') || lower.includes('swiss') || lower.includes('suisse') || lower.includes('hund')) return 'geneva';
  return null;
}

/**
 * Daily Event Discovery Cron
 *
 * Scans ALL 8 cities every day using rotating hashtag subsets.
 * Each run picks 1 global + 1 city-specific hashtag per city = ~9 hashtag lookups.
 * This ensures every city gets fresh discovery daily while staying within
 * Instagram Graph API rate limits (30 unique hashtags per 7-day window).
 *
 * The rotation uses day-of-year to cycle through each city's hashtag pool,
 * so over a week every hashtag gets checked at least once.
 *
 * Runs daily at 8 AM UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
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
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

  // ─── Build today's hashtag set ─────────────────────────────────────────────
  // Strategy: 1 rotating global hashtag + 1 rotating city-specific per city
  // = ~9 hashtag API calls per run (well within rate limits)
  // Over 2 weeks, every single hashtag in every city gets scanned

  const globalHashtag = GLOBAL_EVENT_HASHTAGS[dayOfYear % GLOBAL_EVENT_HASHTAGS.length];
  const selectedHashtags: Array<{ hashtag: string; city: string | null }> = [
    { hashtag: globalHashtag, city: null },
  ];

  for (const [cityKey, cityData] of Object.entries(CITY_HASHTAGS)) {
    const idx = dayOfYear % cityData.hashtags.length;
    selectedHashtags.push({
      hashtag: cityData.hashtags[idx],
      city: cityKey,
    });
    // On weekends (extra capacity), add a second hashtag per city
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const idx2 = (dayOfYear + 7) % cityData.hashtags.length;
      if (idx2 !== idx) {
        selectedHashtags.push({
          hashtag: cityData.hashtags[idx2],
          city: cityKey,
        });
      }
    }
  }

  console.log(`[EVENT-DISCOVERY] Day ${dayOfYear} — scanning ${selectedHashtags.length} hashtags across all cities`);
  console.log(`[EVENT-DISCOVERY] Hashtags: ${selectedHashtags.map(h => `#${h.hashtag} (${h.city || 'global'})`).join(', ')}`);

  const discoveredEvents: Array<{
    caption: string;
    permalink: string;
    username: string;
    city: string | null;
    score: number;
    likes: number;
    hashtag: string;
    mentionedHandles: string[];
    isBusiness: boolean;
  }> = [];

  // Search each hashtag
  for (const { hashtag, city: hintCity } of selectedHashtags) {
    try {
      // Step 1: Get hashtag ID
      const searchUrl = `https://graph.facebook.com/${META_API_VERSION}/ig_hashtag_search?q=${encodeURIComponent(hashtag)}&user_id=${INSTAGRAM_ACCOUNT_ID}&access_token=${META_PAGE_ACCESS_TOKEN}`;
      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
      const searchData = await searchRes.json();

      if (!searchData.data?.[0]?.id) {
        console.warn(`[EVENT-DISCOVERY] No hashtag ID for #${hashtag}`);
        continue;
      }

      const hashtagId = searchData.data[0].id;

      // Step 2: Get recent media (increased to 30 per hashtag for better coverage)
      const mediaUrl = `https://graph.facebook.com/${META_API_VERSION}/${hashtagId}/recent_media?user_id=${INSTAGRAM_ACCOUNT_ID}&fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=30&access_token=${META_PAGE_ACCESS_TOKEN}`;
      const mediaRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(15000) });
      const mediaData = await mediaRes.json();

      if (!mediaData.data) {
        console.warn(`[EVENT-DISCOVERY] No media for #${hashtag}: ${JSON.stringify(mediaData.error || {})}`);
        continue;
      }

      let foundCount = 0;

      // Step 3: Classify each post
      for (const post of mediaData.data as MediaItem[]) {
        const score = classifyEventRelevance(post.caption || '', post.like_count || 0);
        if (score < 18) continue; // Slightly lower threshold to catch more events

        const usernameMatch = post.permalink?.match(/instagram\.com\/([^\/]+)\//);
        const username = usernameMatch?.[1] || 'unknown';

        // Detect city from caption first, then fall back to hashtag hint
        const city = detectCity(post.caption || '') || hintCity || detectCityFromHashtag(hashtag);

        // Extract business/sponsor handles from the caption
        const mentionedHandles = extractMentionedHandles(post.caption || '');
        const isBusiness = isBusinessPost(post.caption || '', username);

        discoveredEvents.push({
          caption: (post.caption || '').substring(0, 800), // More caption for context
          permalink: post.permalink,
          username,
          city,
          score,
          likes: post.like_count || 0,
          hashtag,
          mentionedHandles,
          isBusiness,
        });
        foundCount++;
      }

      console.log(`[EVENT-DISCOVERY] #${hashtag}: ${mediaData.data.length} posts scanned, ${foundCount} candidates`);
    } catch (err) {
      console.error(`[EVENT-DISCOVERY] Error scanning #${hashtag}:`, err);
    }

    // Small delay between API calls to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // Sort by score descending, take top 30 (increased from 20)
  discoveredEvents.sort((a, b) => b.score - a.score);
  const topEvents = discoveredEvents.slice(0, 30);

  // Insert into ingest_queue for admin review
  let inserted = 0;
  let businessesFound = 0;
  const cityCounts: Record<string, number> = {};

  for (const event of topEvents) {
    try {
      // Check for duplicates by permalink
      const { data: existing } = await supabase
        .from('ingest_queue')
        .select('id')
        .eq('url', event.permalink)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Also check events table for this permalink
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('source_post_url', event.permalink)
        .limit(1);

      if (existingEvent && existingEvent.length > 0) continue;

      // Build a rich subject line with business context
      const bizTag = event.isBusiness ? ' [BUSINESS]' : '';
      const handleTag = event.mentionedHandles.length > 0
        ? ` | mentions: @${event.mentionedHandles.slice(0, 3).join(', @')}`
        : '';

      await supabase.from('ingest_queue').insert({
        source: 'event_discovery',
        submitted_by: 'cron:event-discovery',
        url: event.permalink,
        raw_text: event.caption,
        subject: `Event candidate (score: ${event.score}) from #${event.hashtag}${bizTag}${handleTag}`,
        platform: 'instagram',
        content_type: 'post',
        instagram_username: event.username,
        classification: event.isBusiness ? 'business_event' : 'event',
        city: event.city,
        priority: event.score >= 50 ? 'high' : event.isBusiness ? 'high' : 'normal',
        status: 'pending',
      });
      inserted++;
      if (event.isBusiness) businessesFound++;
      if (event.city) {
        cityCounts[event.city] = (cityCounts[event.city] || 0) + 1;
      }
    } catch (err) {
      console.error(`[EVENT-DISCOVERY] Insert error for ${event.permalink}:`, err);
    }
  }

  const summary = `Scanned ${selectedHashtags.length} hashtags across all 8 cities, found ${discoveredEvents.length} event candidates (score >= 18), inserted ${inserted} new items (${businessesFound} business-related)`;
  console.log(`[EVENT-DISCOVERY] ${summary}`);
  console.log(`[EVENT-DISCOVERY] City breakdown: ${JSON.stringify(cityCounts)}`);

  return NextResponse.json({
    success: true,
    hashtagsScanned: selectedHashtags.map(h => h.hashtag),
    citiesScanned: Object.keys(CITY_HASHTAGS),
    totalCandidates: discoveredEvents.length,
    inserted,
    businessesFound,
    cityCounts,
    topEvents: topEvents.slice(0, 8).map(e => ({
      permalink: e.permalink,
      username: e.username,
      score: e.score,
      city: e.city,
      hashtag: e.hashtag,
      mentionedHandles: e.mentionedHandles,
      isBusiness: e.isBusiness,
    })),
    summary,
  });
}

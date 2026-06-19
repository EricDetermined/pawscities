import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getTodaysSources, scrapeCuratedSource, type ExtractedEvent } from '@/lib/curated-sources';
function getMetaToken() { return process.env.META_PAGE_ACCESS_TOKEN; }
function getInstagramAccountId() { return process.env.INSTAGRAM_ACCOUNT_ID; }
function getMetaApiVersion() { return process.env.META_API_VERSION || 'v21.0'; }
function getApifyToken() { return process.env.APIFY_TOKEN; }
function getOpenAIKey() { return process.env.OPENAI_API_KEY; }

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 300; // Increased to 5 min for Google Events + Vision scanning

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
  newyork: {
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
  'dogmeetup', 'dogfriendlycafe', 'dogfriendly',
  'dogadoption', 'dogrescue', 'petadoptionevent',
  'dogfriendlyevent', 'barkinthpark', 'pupupevent',
  'yappyhour', 'dogbrunch', 'dogfriendlyvenue',
  'dogsofinstagram', 'petfriendlyevent', 'dogday',
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

// ─── Google Events search queries per city (in local language + English) ────
// Apify Google Events Scraper: codingfrontend~google-events-scraper
// Each city gets 2 queries: one in English, one in local language for broader coverage

const GOOGLE_EVENT_QUERIES: Record<string, {
  queries: string[];
  location: string;
  gl: string;  // Google country code
  hl: string;  // Google language code
}> = {
  losangeles: {
    queries: ['dog friendly events Los Angeles', 'dog events LA this month'],
    location: 'Los Angeles, CA',
    gl: 'us', hl: 'en',
  },
  newyork: {
    queries: ['dog friendly events New York', 'dog events NYC this month'],
    location: 'New York, NY',
    gl: 'us', hl: 'en',
  },
  london: {
    queries: ['dog friendly events London', 'dog events London this month'],
    location: 'London, UK',
    gl: 'uk', hl: 'en',
  },
  paris: {
    queries: ['événements chiens Paris', 'dog friendly events Paris'],
    location: 'Paris, France',
    gl: 'fr', hl: 'fr',
  },
  barcelona: {
    queries: ['eventos perros Barcelona', 'dog friendly events Barcelona'],
    location: 'Barcelona, Spain',
    gl: 'es', hl: 'es',
  },
  tokyo: {
    queries: ['犬 イベント 東京', 'dog friendly events Tokyo'],
    location: 'Tokyo, Japan',
    gl: 'jp', hl: 'ja',
  },
  sydney: {
    queries: ['dog friendly events Sydney', 'dog events Sydney this month'],
    location: 'Sydney, Australia',
    gl: 'au', hl: 'en',
  },
  geneva: {
    queries: ['événements chiens Genève', 'dog friendly events Geneva'],
    location: 'Geneva, Switzerland',
    gl: 'ch', hl: 'fr',
  },
};

// ─── Google Events via Apify ────────────────────────────────────────────────

// Apify Google Events Scraper returns varied field names depending on version
// We accept all known variations and normalize them
interface ApifyGoogleEvent {
  // Title fields
  title?: string;
  name?: string;
  // Date fields
  date?: string | { start_date?: string; when?: string };
  when?: string;
  // Description
  description?: string;
  snippet?: string;
  // Link/URL
  link?: string;
  url?: string;
  event_location_map?: { link?: string };
  // Venue
  venue?: string;
  location?: string;
  // Address
  address?: string;
  // Images
  image?: string;
  thumbnail?: string;
  // Raw fields (log for debugging)
  [key: string]: unknown;
}

async function discoverGoogleEvents(citySlug: string): Promise<Array<{
  name: string;
  date: string | null;
  description: string | null;
  venue: string | null;
  address: string | null;
  url: string | null;
  imageUrl: string | null;
  city: string;
  source: 'google_events';
  score: number;
}>> {
  const APIFY_TOKEN = getApifyToken();
  if (!APIFY_TOKEN) {
    console.warn('[GOOGLE-EVENTS] APIFY_TOKEN not configured, skipping');
    return [];
  }

  const cityConfig = GOOGLE_EVENT_QUERIES[citySlug];
  if (!cityConfig) return [];

  const results: Array<{
    name: string;
    date: string | null;
    description: string | null;
    venue: string | null;
    address: string | null;
    url: string | null;
    imageUrl: string | null;
    city: string;
    source: 'google_events';
    score: number;
  }> = [];

  // Rotate queries daily — use 1 query per city per run to stay within Apify limits
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const queryIndex = dayOfYear % cityConfig.queries.length;
  const query = cityConfig.queries[queryIndex];

  console.log(`[GOOGLE-EVENTS] Searching "${query}" for ${citySlug}`);

  try {
    const apifyUrl = `https://api.apify.com/v2/acts/codingfrontend~google-events-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
    const res = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        location: cityConfig.location,
        gl: cityConfig.gl,
        hl: cityConfig.hl,
        maxItems: 20,
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout for Apify sync run
    });

    if (!res.ok) {
      console.error(`[GOOGLE-EVENTS] Apify returned ${res.status} for ${citySlug}`);
      return [];
    }

    const events = (await res.json()) as ApifyGoogleEvent[];
    console.log(`[GOOGLE-EVENTS] Got ${events.length} results for ${citySlug}`);

    // Log first result's keys so we can see the actual shape
    if (events.length > 0) {
      const sampleKeys = Object.keys(events[0]).filter(k => events[0][k] != null);
      console.log(`[GOOGLE-EVENTS] Sample fields: ${sampleKeys.join(', ')}`);
      console.log(`[GOOGLE-EVENTS] Sample: ${JSON.stringify(events[0]).substring(0, 500)}`);
    }

    for (const event of events) {
      // Normalize field names — Apify scrapers use varied schemas
      const eventTitle = event.title || event.name || '';
      if (!eventTitle) continue;

      // Normalize date — can be string, object, or in 'when' field
      let eventDate: string | null = null;
      if (typeof event.date === 'string') {
        eventDate = event.date;
      } else if (typeof event.date === 'object' && event.date) {
        eventDate = event.date.start_date || event.date.when || null;
      }
      if (!eventDate && event.when) {
        eventDate = String(event.when);
      }

      // Normalize other fields
      const eventDescription = event.description || event.snippet || '';
      const eventVenue = event.venue || (typeof event.location === 'string' ? event.location : null) || null;
      const eventLink = event.link || event.url || event.event_location_map?.link || null;

      // Filter: must be dog-related (strict word-boundary matching to avoid false positives)
      const titleLower = eventTitle.toLowerCase();
      const descLower = eventDescription.toLowerCase();
      const combined = titleLower + ' ' + descLower;

      // Strong dog signals — word-boundary regex to prevent matching "parking" for "park" etc.
      const strongDogPatterns = [
        /\bdog(s|gy|gie)?\b/, /\bpup(py|pies|s)?\b/, /\bcanine\b/, /\bbark\b/,
        /\bwoof\b/, /\bpaw(s)?\b/, /\bfetch\b/, /\bleash\b/, /\bk-?9\b/, /\bk9\b/,
        /\bchien(s|ne)?\b/, /\bperro(s)?\b/, /\bhund(e|en)?\b/,
        /犬/, /わんこ/, /ドッグ/,
      ];
      // Weaker signals — match these but require at least one strong signal too
      const weakDogPatterns = [
        /\bpet(s)?\b/, /\brescue\b/, /\badoption\b/, /\bfurry\b/,
        /\bpet[\s-]?friendly\b/, /\bfour[\s-]?legged\b/,
      ];

      const strongMatch = strongDogPatterns.some(p => p.test(combined));
      const weakMatch = weakDogPatterns.some(p => p.test(combined));

      if (!strongMatch && !weakMatch) continue;

      // Score the relevance (replaces flat 60 base)
      let googleScore = 30; // base for being a structured Google Event
      if (strongMatch) googleScore += 20; // confirmed dog-related
      if (weakMatch) googleScore += 5;
      // Bonus for title-level dog keywords (not just description)
      if (strongDogPatterns.some(p => p.test(titleLower))) googleScore += 10;
      // Bonus for having date info
      if (eventDate) googleScore += 5;
      // Bonus for having venue info
      if (eventVenue) googleScore += 5;

      // Skip if only weak match with low score
      if (!strongMatch && googleScore < 40) continue;

      results.push({
        name: eventTitle,
        date: eventDate,
        description: eventDescription.substring(0, 500) || null,
        venue: eventVenue,
        address: event.address || null,
        url: eventLink,
        imageUrl: event.image || event.thumbnail || null,
        city: citySlug,
        source: 'google_events',
        score: googleScore,
      });
    }
  } catch (err) {
    console.error(`[GOOGLE-EVENTS] Error for ${citySlug}:`, err);
  }

  return results;
}

// ─── GPT-4o Vision for Instagram Event Posters ──────────────────────────────
// For high-scoring Instagram posts with images, send the image to GPT-4o Vision
// to extract structured event details from posters/flyers

interface VisionEventDetails {
  eventName: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  address: string | null;
  organizer: string | null;
  ticketUrl: string | null;
  description: string | null;
  isEventPoster: boolean;
}

async function scanPosterWithVision(imageUrl: string): Promise<VisionEventDetails | null> {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY) {
    console.warn('[VISION] OPENAI_API_KEY not configured, skipping poster scan');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // cost-effective for poster reading
        messages: [
          {
            role: 'system',
            content: `You are an event detail extractor for a dog-friendly events platform.
Analyze the image and determine if it's an event poster/flyer. If it IS an event poster, extract the structured details.
Respond ONLY with valid JSON, no markdown. Use this exact schema:
{
  "isEventPoster": true/false,
  "eventName": "string or null",
  "date": "YYYY-MM-DD or descriptive string or null",
  "time": "HH:MM or descriptive string or null",
  "venue": "venue name or null",
  "address": "full address or null",
  "organizer": "@handle or organization name or null",
  "ticketUrl": "url or null",
  "description": "brief 1-2 sentence description or null"
}
If it's not an event poster (just a photo of a dog, meme, etc.), set isEventPoster to false and all other fields to null.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'low' }, // low detail to save tokens
              },
              {
                type: 'text',
                text: 'Is this an event poster or flyer? If yes, extract the event details.',
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[VISION] OpenAI returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    // Parse the JSON response (strip any markdown wrapping)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr) as VisionEventDetails;
    return parsed;
  } catch (err) {
    console.error('[VISION] Error scanning poster:', err);
    return null;
  }
}

interface MediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
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
    newyork: ['new york', 'nyc', 'brooklyn', 'manhattan', 'queens', 'bronx', 'east village',
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
  if (lower.includes('nyc') || lower.includes('newyork') || lower.includes('brooklyn')) return 'newyork';
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

  const instagramConfigured = !!(META_PAGE_ACCESS_TOKEN && INSTAGRAM_ACCOUNT_ID);
  const apifyConfigured = !!getApifyToken();
  const visionConfigured = !!getOpenAIKey();

  if (!instagramConfigured && !apifyConfigured) {
    console.error('[EVENT-DISCOVERY] No discovery channels configured (need Instagram or Apify)');
    return NextResponse.json({ error: 'No discovery channels configured' }, { status: 500 });
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
    visionEnriched?: boolean;
    source?: string;
  }> = [];

  // Vision scan budget — limit per run to control OpenAI costs
  const VISION_SCAN_BUDGET = 5;
  let visionScansUsed = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL 1: Instagram Hashtag Discovery (existing)
  // ═══════════════════════════════════════════════════════════════════════════

  if (!instagramConfigured) {
    console.log('[EVENT-DISCOVERY] Instagram not configured, skipping hashtag discovery');
  }

  // Search each hashtag (only if Instagram is configured)
  if (instagramConfigured)
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
      // Include media_url for Vision poster scanning on high-scoring IMAGE posts
      const mediaUrl = `https://graph.facebook.com/${META_API_VERSION}/${hashtagId}/recent_media?user_id=${INSTAGRAM_ACCOUNT_ID}&fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=30&access_token=${META_PAGE_ACCESS_TOKEN}`;
      const mediaRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(15000) });
      const mediaData = await mediaRes.json();

      if (!mediaData.data) {
        console.warn(`[EVENT-DISCOVERY] No media for #${hashtag}: ${JSON.stringify(mediaData.error || {})}`);
        continue;
      }

      let foundCount = 0;

      // Step 3: Classify each post
      for (const post of mediaData.data as MediaItem[]) {
        let score = classifyEventRelevance(post.caption || '', post.like_count || 0);
        if (score < 35) continue; // Raised threshold — quality over quantity

        const usernameMatch = post.permalink?.match(/instagram\.com\/([^\/]+)\//);
        const username = usernameMatch?.[1] || 'unknown';

        // Detect city from caption first, then fall back to hashtag hint
        let city = detectCity(post.caption || '') || hintCity || detectCityFromHashtag(hashtag);

        // Extract business/sponsor handles from the caption
        const mentionedHandles = extractMentionedHandles(post.caption || '');
        const isBusiness = isBusinessPost(post.caption || '', username);

        let caption = (post.caption || '').substring(0, 800);
        let visionEnriched = false;

        // ─── GPT-4o Vision: scan high-scoring IMAGE posts for event poster details ──
        // Only scan if: Vision is configured, it's an IMAGE, score >= 30 (likely event),
        // and we haven't hit our per-run Vision budget (max 5 scans to control costs)
        if (
          visionConfigured &&
          post.media_type === 'IMAGE' &&
          post.media_url &&
          score >= 30 &&
          visionScansUsed < VISION_SCAN_BUDGET
        ) {
          console.log(`[VISION] Scanning poster for ${post.permalink} (score: ${score})`);
          const visionResult = await scanPosterWithVision(post.media_url);
          visionScansUsed++;

          if (visionResult?.isEventPoster) {
            console.log(`[VISION] Found event poster: "${visionResult.eventName}" at ${visionResult.venue}`);
            // Boost score significantly — this is a confirmed event poster
            score = Math.min(score + 25, 100);
            visionEnriched = true;

            // Build enriched caption with structured data from the poster
            const enrichedParts: string[] = [];
            if (visionResult.eventName) enrichedParts.push(`Event: ${visionResult.eventName}`);
            if (visionResult.date) enrichedParts.push(`Date: ${visionResult.date}`);
            if (visionResult.time) enrichedParts.push(`Time: ${visionResult.time}`);
            if (visionResult.venue) enrichedParts.push(`Venue: ${visionResult.venue}`);
            if (visionResult.address) enrichedParts.push(`Address: ${visionResult.address}`);
            if (visionResult.organizer) enrichedParts.push(`Organizer: ${visionResult.organizer}`);
            if (visionResult.ticketUrl) enrichedParts.push(`Tickets: ${visionResult.ticketUrl}`);
            if (visionResult.description) enrichedParts.push(`Description: ${visionResult.description}`);
            enrichedParts.push(''); // blank line separator
            enrichedParts.push(caption); // original caption below

            caption = enrichedParts.join('\n');

            // If Vision found a venue with city info, use that for city detection
            if (visionResult.address || visionResult.venue) {
              const visionCity = detectCity(`${visionResult.venue || ''} ${visionResult.address || ''}`);
              if (visionCity) city = visionCity;
            }

            // Add organizer as a mentioned handle if it starts with @
            if (visionResult.organizer && visionResult.organizer.startsWith('@')) {
              const handle = visionResult.organizer.replace('@', '');
              if (!mentionedHandles.includes(handle)) {
                mentionedHandles.push(handle);
              }
            }
          }
        }

        discoveredEvents.push({
          caption,
          permalink: post.permalink,
          username,
          city,
          score,
          likes: post.like_count || 0,
          hashtag,
          mentionedHandles,
          isBusiness,
          visionEnriched,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL 2: Google Events via Apify
  // ═══════════════════════════════════════════════════════════════════════════

  let googleEventsInserted = 0;
  const googleCityCounts: Record<string, number> = {};

  if (apifyConfigured) {
    console.log('[GOOGLE-EVENTS] Starting Google Events discovery via Apify...');

    // Rotate cities: scan 4 cities per run (all 8 over 2 days)
    const allCities = Object.keys(GOOGLE_EVENT_QUERIES);
    const citiesPerRun = 4;
    const startIdx = (dayOfYear % 2) * citiesPerRun;
    const todaysCities = allCities.slice(startIdx, startIdx + citiesPerRun);

    console.log(`[GOOGLE-EVENTS] Today's cities: ${todaysCities.join(', ')}`);

    for (const citySlug of todaysCities) {
      const googleResults = await discoverGoogleEvents(citySlug);

      for (const gEvent of googleResults) {
        // Convert Google Events into the same format as Instagram discoveries
        discoveredEvents.push({
          caption: [
            gEvent.name,
            gEvent.date ? `Date: ${gEvent.date}` : '',
            gEvent.venue ? `Venue: ${gEvent.venue}` : '',
            gEvent.address ? `Address: ${gEvent.address}` : '',
            gEvent.description || '',
          ].filter(Boolean).join('\n'),
          permalink: gEvent.url || `https://www.google.com/search?q=${encodeURIComponent(gEvent.name + ' ' + citySlug)}`,
          username: 'google_events',
          city: gEvent.city,
          score: gEvent.score, // Dynamic score based on dog-relevance (replaces flat 60)
          likes: 0,
          hashtag: 'google_events',
          mentionedHandles: [],
          isBusiness: false,
          source: 'google_events',
        });
        googleCityCounts[citySlug] = (googleCityCounts[citySlug] || 0) + 1;
      }

      // Small delay between Apify calls
      await new Promise(r => setTimeout(r, 1000));
    }

    googleEventsInserted = Object.values(googleCityCounts).reduce((a, b) => a + b, 0);
    console.log(`[GOOGLE-EVENTS] Found ${googleEventsInserted} events across ${todaysCities.length} cities`);
    console.log(`[GOOGLE-EVENTS] City breakdown: ${JSON.stringify(googleCityCounts)}`);
  } else {
    console.log('[GOOGLE-EVENTS] APIFY_TOKEN not configured, skipping Google Events');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL 3: Curated Sources — trusted dog-event listing sites per city
  // Scrapes 1 source per city per day, uses GPT-4o-mini to extract events
  // ═══════════════════════════════════════════════════════════════════════════

  let curatedEventsFound = 0;
  const curatedCityCounts: Record<string, number> = {};
  const curatedSourcesScraped: string[] = [];
  const curatedDirectInserts: Array<{ name: string; city: string; date: string | null }> = [];

  const openaiKey = getOpenAIKey();
  if (openaiKey) {
    console.log('[CURATED-SCRAPER] Starting curated source discovery...');

    const todaysSources = getTodaysSources();
    console.log(`[CURATED-SCRAPER] Today's sources: ${todaysSources.map(s => `${s.citySlug}:${s.source.name}`).join(', ')}`);

    for (const { citySlug, source } of todaysSources) {
      try {
        curatedSourcesScraped.push(`${citySlug}:${source.name}`);
        const extracted = await scrapeCuratedSource(source, citySlug, openaiKey);

        for (const ev of extracted) {
          // Curated events are high quality — they come pre-parsed with AI
          // Insert directly into events table as PENDING (skip ingest_queue)
          curatedEventsFound++;
          curatedCityCounts[citySlug] = (curatedCityCounts[citySlug] || 0) + 1;

          // Also add to discoveredEvents for dedup tracking and reporting
          discoveredEvents.push({
            caption: [
              ev.name,
              ev.date ? `Date: ${ev.date}` : '',
              ev.venueName ? `Venue: ${ev.venueName}` : '',
              ev.venueAddress ? `Address: ${ev.venueAddress}` : '',
              ev.description || '',
            ].filter(Boolean).join('\n'),
            permalink: ev.externalUrl,
            username: 'curated_scrape',
            city: citySlug,
            score: 80, // High score — curated + AI-verified
            likes: 0,
            hashtag: source.name,
            mentionedHandles: [],
            isBusiness: false,
            visionEnriched: false,
            source: 'curated_scrape',
          });

          curatedDirectInserts.push({
            name: ev.name,
            city: citySlug,
            date: ev.date,
          });
        }
      } catch (err) {
        console.error(`[CURATED-SCRAPER] Error scraping ${source.name} for ${citySlug}:`, err);
      }
    }

    console.log(`[CURATED-SCRAPER] Found ${curatedEventsFound} events across ${todaysSources.length} sources`);
  } else {
    console.log('[CURATED-SCRAPER] OpenAI key not configured, skipping curated sources');
  }

  // Sort by score descending, take top 50 (increased for 3 channels)
  discoveredEvents.sort((a, b) => b.score - a.score);
  const topEvents = discoveredEvents.slice(0, 50);

  // ── Helper: normalize title for fuzzy dedup ────────────────────────────
  function normalizeTitle(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  // ── Helper: check if two normalized titles are similar enough to be dupes
  function titlesSimilar(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.length < 5 || b.length < 5) return false;
    // One contains the other
    if (a.includes(b) || b.includes(a)) return true;
    // First N chars match (catches "Bark in the Park LA" vs "Bark in the Park Los Angeles")
    const minLen = Math.min(a.length, b.length);
    const compareLen = Math.min(minLen, 25);
    if (a.substring(0, compareLen) === b.substring(0, compareLen) && compareLen >= 15) return true;
    return false;
  }

  // Track titles we've already inserted this run to catch within-batch dupes
  const insertedTitles: string[] = [];
  let skippedDupes = 0;
  const insertErrors: string[] = [];

  // Insert into ingest_queue for admin review
  let inserted = 0;
  let businessesFound = 0;
  const cityCounts: Record<string, number> = {};

  for (const event of topEvents) {
    try {
      // ── Dedup Layer 1: Check permalink URL ─────────────────────────────
      const { data: existing } = await supabase
        .from('ingest_queue')
        .select('id')
        .eq('url', event.permalink)
        .limit(1);

      if (existing && existing.length > 0) { skippedDupes++; continue; }

      // Also check events table for this permalink
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('source_post_url', event.permalink)
        .limit(1);

      if (existingEvent && existingEvent.length > 0) { skippedDupes++; continue; }

      // ── Dedup Layer 2: Fuzzy title matching ────────────────────────────
      // Extract a rough title from the caption (first line or Event: line)
      const captionLines = event.caption.split('\n').filter(l => l.trim());
      const roughTitle = captionLines[0]?.replace(/^Event:\s*/i, '').trim() || '';
      const normalizedTitle = normalizeTitle(roughTitle);

      if (normalizedTitle.length >= 8) {
        // Check within this batch
        if (insertedTitles.some(t => titlesSimilar(t, normalizedTitle))) {
          console.log(`[EVENT-DISCOVERY] Skipping within-batch dupe: "${roughTitle}"`);
          skippedDupes++;
          continue;
        }

        // Check ingest_queue for similar titles (last 14 days)
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const searchTerm = roughTitle.substring(0, 30);
        const { data: similarIngest } = await supabase
          .from('ingest_queue')
          .select('id, raw_text')
          .ilike('raw_text', `%${searchTerm}%`)
          .gte('created_at', fourteenDaysAgo)
          .limit(5);

        if (similarIngest && similarIngest.length > 0) {
          const isDupe = similarIngest.some(item => {
            const itemFirstLine = (item.raw_text || '').split('\n')[0]?.replace(/^Event:\s*/i, '').trim() || '';
            return titlesSimilar(normalizeTitle(itemFirstLine), normalizedTitle);
          });
          if (isDupe) {
            console.log(`[EVENT-DISCOVERY] Skipping ingest-queue dupe: "${roughTitle}"`);
            skippedDupes++;
            continue;
          }
        }

        // Check events table for similar names
        const { data: similarEvents } = await supabase
          .from('events')
          .select('id, name')
          .ilike('name', `%${searchTerm}%`)
          .limit(5);

        if (similarEvents && similarEvents.length > 0) {
          const isDupe = similarEvents.some(ev => titlesSimilar(normalizeTitle(ev.name), normalizedTitle));
          if (isDupe) {
            console.log(`[EVENT-DISCOVERY] Skipping events-table dupe: "${roughTitle}"`);
            skippedDupes++;
            continue;
          }
        }

        insertedTitles.push(normalizedTitle);
      }

      // Build a rich subject line — use actual event name when available
      const isGoogle = event.source === 'google_events';
      const isCurated = event.source === 'curated_scrape';
      const bizTag = event.isBusiness ? ' [BUSINESS]' : '';
      const visionTag = event.visionEnriched ? ' [POSTER-SCANNED]' : '';
      const handleTag = event.mentionedHandles.length > 0
        ? ` | mentions: @${event.mentionedHandles.slice(0, 3).join(', @')}`
        : '';

      // For curated and Google events, use the actual event name as the subject
      // so process-ingest doesn't fall back to "Event candidate (score: X)"
      let subjectLine: string;
      if (isCurated || isGoogle) {
        const firstLine = event.caption.split('\n')[0]?.replace(/^Event:\s*/i, '').trim() || '';
        subjectLine = firstLine || `Event (score: ${event.score})`;
      } else {
        const sourceLabel = `#${event.hashtag}`;
        subjectLine = `Event candidate (score: ${event.score}) from ${sourceLabel}${bizTag}${visionTag}${handleTag}`;
      }

      const sourceValue = isCurated ? 'event_discovery' : (isGoogle ? 'google_events' : 'event_discovery');
      const platformValue = isCurated ? 'website' : (isGoogle ? 'google' : 'instagram');

      const { error: insertError } = await supabase.from('ingest_queue').insert({
        source: sourceValue,
        submitted_by: 'cron:event-discovery',
        url: event.permalink,
        raw_text: event.caption,
        subject: subjectLine,
        platform: platformValue,
        content_type: isCurated ? 'curated_event' : (isGoogle ? 'event_listing' : 'post'),
        instagram_username: (isGoogle || isCurated) ? null : event.username,
        classification: event.isBusiness ? 'business_event' : 'event',
        city: event.city,
        priority: event.score >= 50 ? 'high' : event.isBusiness ? 'high' : event.visionEnriched ? 'high' : 'normal',
        status: 'pending',
      });
      if (insertError) {
        console.error(`[EVENT-DISCOVERY] DB insert failed for "${event.permalink}":`, insertError.message);
        insertErrors.push(`${event.city}: ${insertError.message}`);
        continue;
      }
      inserted++;
      if (event.isBusiness) businessesFound++;
      if (event.city) {
        cityCounts[event.city] = (cityCounts[event.city] || 0) + 1;
      }
    } catch (err) {
      console.error(`[EVENT-DISCOVERY] Insert error for ${event.permalink}:`, err);
    }
  }

  const visionEnrichedCount = topEvents.filter(e => e.visionEnriched).length;
  const googleCount = topEvents.filter(e => e.source === 'google_events').length;
  const curatedCount = topEvents.filter(e => e.source === 'curated_scrape').length;
  const instagramCount = topEvents.filter(e => !e.source || e.source === 'instagram').length;

  const summary = [
    `Scanned ${selectedHashtags.length} hashtags + ${apifyConfigured ? Object.keys(googleCityCounts).length : 0} Google cities + ${curatedSourcesScraped.length} curated sources`,
    `Found ${discoveredEvents.length} candidates (IG: ${instagramCount}, Google: ${googleCount}, Curated: ${curatedCount})`,
    `Inserted ${inserted} new items (${businessesFound} business, ${visionEnrichedCount} poster-scanned, ${curatedEventsFound} curated)`,
    skippedDupes > 0 ? `Skipped ${skippedDupes} duplicates` : '',
    visionScansUsed > 0 ? `Vision: ${visionScansUsed}/${VISION_SCAN_BUDGET}` : '',
  ].filter(Boolean).join('. ');

  console.log(`[EVENT-DISCOVERY] ${summary}`);
  console.log(`[EVENT-DISCOVERY] City breakdown: ${JSON.stringify(cityCounts)}`);
  if (Object.keys(googleCityCounts).length > 0) {
    console.log(`[GOOGLE-EVENTS] City breakdown: ${JSON.stringify(googleCityCounts)}`);
  }

  return NextResponse.json({
    success: true,
    channels: {
      instagram: {
        configured: instagramConfigured,
        hashtagsScanned: instagramConfigured ? selectedHashtags.map(h => h.hashtag) : [],
        candidates: instagramCount,
      },
      googleEvents: {
        configured: apifyConfigured,
        citiesScanned: apifyConfigured ? Object.keys(googleCityCounts) : [],
        candidates: googleCount,
      },
      vision: {
        configured: visionConfigured,
        scansUsed: visionScansUsed,
        budget: VISION_SCAN_BUDGET,
        postersFound: visionEnrichedCount,
      },
      curatedSources: {
        configured: !!openaiKey,
        sourcesScraped: curatedSourcesScraped,
        eventsFound: curatedEventsFound,
        directInserts: curatedDirectInserts.slice(0, 10),
      },
    },
    citiesScanned: Object.keys(CITY_HASHTAGS),
    totalCandidates: discoveredEvents.length,
    inserted,
    skippedDupes,
    insertErrors: insertErrors.length > 0 ? insertErrors.slice(0, 10) : undefined,
    businessesFound,
    cityCounts: { ...cityCounts, ...googleCityCounts, ...curatedCityCounts },
    topEvents: topEvents.slice(0, 10).map(e => ({
      permalink: e.permalink,
      username: e.username,
      score: e.score,
      city: e.city,
      hashtag: e.hashtag,
      mentionedHandles: e.mentionedHandles,
      isBusiness: e.isBusiness,
      visionEnriched: e.visionEnriched || false,
      source: e.source || 'instagram',
    })),
    summary,
  });
}

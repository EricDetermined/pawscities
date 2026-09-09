/**
 * Shared event-discovery helpers.
 *
 * Extracted from src/app/api/cron/event-discovery/route.ts so multiple
 * discovery channels (hashtag discovery, handle discovery, ...) reuse the
 * exact same event-likeness scoring, geo disambiguation, date resolution
 * and GPT-4o Vision poster extraction instead of duplicating them.
 */

// ─── Event classification keywords ──────────────────────────────────────────

export const EVENT_KEYWORDS = [
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

export const VENUE_KEYWORDS = [
  'park', 'beach', 'garden', 'plaza', 'square', 'hotel', 'restaurant',
  'café', 'cafe', 'bar', 'brewery', 'winery', 'rooftop', 'stadium',
  'arena', 'pier', 'boardwalk', 'shelter', 'rescue', 'sanctuary',
  'pet store', 'pet shop', 'groomer', 'vet', 'veterinary', 'clinic',
  'doggy daycare', 'dog run', 'dog park',
];

// Business/organization keywords — these indicate the post is from or about a business
export const BUSINESS_KEYWORDS = [
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

// ─── Event-likeness scoring ─────────────────────────────────────────────────

export function classifyEventRelevance(caption: string, likeCount: number): number {
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
export function extractMentionedHandles(caption: string): string[] {
  const matches = (caption || '').match(/@([a-zA-Z0-9_.]{1,30})/g) || [];
  return matches
    .map(m => m.replace('@', ''))
    .filter(h => !['thepawcities', 'instagram', 'facebook'].includes(h.toLowerCase()));
}

/** Detect if a post is from a business (vs individual dog owner) */
export function isBusinessPost(caption: string, username: string): boolean {
  const lower = (caption || '').toLowerCase();
  const bizSignals = BUSINESS_KEYWORDS.filter(kw => lower.includes(kw));
  // Username patterns that suggest business accounts
  const bizUsernamePatterns = [
    /pet|paw|dog|pup|woof|bark|canine|groomer|vet|rescue|shelter|kennel|daycare|treat|bakery|boutique/i,
  ];
  const isBizUsername = bizUsernamePatterns.some(p => p.test(username));
  return bizSignals.length >= 2 || (bizSignals.length >= 1 && isBizUsername);
}

// ─── Geo disambiguation ─────────────────────────────────────────────────────
// Reject posts whose location keywords collide with our cities but are elsewhere
// (e.g. "London, Ontario" is NOT London UK; "Paris, Texas" is NOT Paris FR).
export const CITY_GEO_CONFLICTS: Record<string, string[]> = {
  london: ['ontario', 'ldnont', 'canada', 'wortley', 'london ohio', 'london kentucky', '#ldnontario'],
  paris: ['paris texas', 'paris tx', 'paris tennessee', 'paris ontario', 'paris kentucky'],
  sydney: ['nova scotia', 'sydney ns', 'cape breton'],
  barcelona: ['barcelona venezuela'],
  geneva: ['geneva ny', 'geneva illinois', 'geneva ohio', 'lake geneva wi', 'lake geneva wisconsin'],
  newyork: [],
  losangeles: [],
  tokyo: [],
  atlanta: ['atlanta texas', 'atlanta illinois'],
};

export function hasGeoConflict(city: string, caption: string): boolean {
  const lower = (caption || '').toLowerCase();
  const conflicts = CITY_GEO_CONFLICTS[city] || [];
  return conflicts.some(kw => lower.includes(kw));
}

export function detectCity(caption: string): string | null {
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
    if (keywords.some(kw => lower.includes(kw))) {
      // Geo disambiguation: "London, Ontario" must NOT match London UK, etc.
      if (hasGeoConflict(city, caption)) {
        console.log(`[GEO-FILTER] Rejected ${city} match — conflicting location keywords in caption`);
        return null;
      }
      return city;
    }
  }
  return null;
}

// ─── Smart date resolution ──────────────────────────────────────────────────
// Parse a date string; if it has no explicit year (e.g. "Aug 12"), resolve to
// the NEXT upcoming occurrence instead of JS default year 2001.
export function resolveEventDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const hasExplicitYear = /\b(19|20)\d{2}\b/.test(s);
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  if (hasExplicitYear) return parsed;
  // No year given — JS may have defaulted to 2001 or current year
  const now = new Date();
  const candidate = new Date(now.getFullYear(), parsed.getMonth(), parsed.getDate());
  // If that date already passed more than 7 days ago, assume next year
  if (candidate.getTime() < now.getTime() - 7 * 24 * 60 * 60 * 1000) {
    candidate.setFullYear(now.getFullYear() + 1);
  }
  return candidate;
}

/** True if the event date is clearly in the past (rejects), false if future or unknown */
export function isPastEventDate(dateStr: string | null | undefined): boolean {
  const resolved = resolveEventDate(dateStr);
  if (!resolved) return false; // unknown date — let process-ingest handle it
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  return resolved.getTime() < startOfToday.getTime();
}

// ─── GPT-4o Vision for Instagram Event Posters ──────────────────────────────
// For high-scoring posts with images, send the image to GPT-4o Vision
// to extract structured event details from posters/flyers

export interface VisionEventDetails {
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

export async function scanPosterWithVision(imageUrl: string): Promise<VisionEventDetails | null> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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

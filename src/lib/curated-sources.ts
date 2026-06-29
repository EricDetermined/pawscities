/**
 * Curated Sources — trusted dog-event listing sites per city.
 *
 * Each source is a listing page URL that contains links to individual events.
 * The scraper:
 *   1. Fetches the listing page
 *   2. Extracts article/event links
 *   3. Fetches each event page
 *   4. Uses GPT-4o-mini to extract structured event data
 *   5. Returns normalized events ready for ingest_queue
 *
 * Sources are rotated daily to stay within rate/budget limits.
 */

// ─── Source Configuration ────────────────────────────────────────────────────

export interface CuratedSource {
  url: string;
  name: string;
  language: string;
  /** CSS-like hints for link extraction (used as regex patterns on href) */
  linkPattern: string;
  /** Max events to scrape per run from this source */
  maxEvents: number;
  /**
   * If true, this source is a competitor aggregator (e.g. BringFido).
   * The scraper will extract the original event organizer URL from each page
   * and use that instead of the aggregator URL. Events without an original
   * source URL are skipped entirely — we never link our audience to competitors.
   */
  isAggregator?: boolean;
}

export const CURATED_SOURCES: Record<string, CuratedSource[]> = {
  losangeles: [
    {
      url: 'https://www.bringfido.com/event/city/los_angeles_ca_us/',
      name: 'BringFido LA',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 8,
      isAggregator: true,
    },
    {
      url: 'https://sidewalkdog.com/los-angeles-ca/events',
      name: 'Sidewalk Dog LA',
      language: 'en',
      linkPattern: '/events/',
      maxEvents: 6,
    },
    {
      url: 'https://www.eventbrite.com/d/ca--los-angeles/dog-events/',
      name: 'Eventbrite LA Dogs',
      language: 'en',
      linkPattern: '/e/',
      maxEvents: 8,
    },
  ],
  newyork: [
    {
      url: 'https://www.eventbrite.com/d/ny--new-york/dog-events/',
      name: 'Eventbrite NYC Dogs',
      language: 'en',
      linkPattern: '/e/',
      maxEvents: 8,
    },
    {
      url: 'https://sidewalkdog.com/new-york-ny/events',
      name: 'Sidewalk Dog NYC',
      language: 'en',
      linkPattern: '/events/',
      maxEvents: 6,
    },
    {
      url: 'https://www.bringfido.com/event/city/new_york_ny_us/',
      name: 'BringFido NYC',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 8,
      isAggregator: true,
    },
  ],
  london: [
    {
      url: 'https://thedogvine.com/whats-on/',
      name: 'The Dogvine London',
      language: 'en',
      linkPattern: 'thedogvine\\.com/(?!feed|comments|wp-|tag|category|author)[^/]+',
      maxEvents: 8,
    },
    {
      url: 'https://www.eventbrite.co.uk/d/united-kingdom--london/dog-events/',
      name: 'Eventbrite London Dogs',
      language: 'en',
      linkPattern: '/e/',
      maxEvents: 8,
    },
  ],
  paris: [
    {
      url: 'https://www.sortiraparis.com/articles/tag/sortie-chien-guide',
      name: 'Sortir à Paris - Chiens',
      language: 'fr',
      linkPattern: 'sortiraparis\\.com/.+/articles/\\d+',
      maxEvents: 8,
    },
    {
      url: 'https://www.eventbrite.fr/d/france--paris/dog-events/',
      name: 'Eventbrite Paris Dogs',
      language: 'fr',
      linkPattern: '/e/',
      maxEvents: 6,
    },
    {
      url: 'https://www.bringfido.com/event/country/france/',
      name: 'BringFido France',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 6,
      isAggregator: true,
    },
  ],
  barcelona: [
    {
      url: 'https://www.eventbrite.es/d/spain--barcelona/dog-events/',
      name: 'Eventbrite Barcelona Dogs',
      language: 'es',
      linkPattern: '/e/',
      maxEvents: 6,
    },
    {
      url: 'https://www.bringfido.com/attraction/city/barcelona_es/',
      name: 'BringFido Barcelona',
      language: 'en',
      linkPattern: '/event/\\d+|/attraction/\\d+',
      maxEvents: 6,
      isAggregator: true,
    },
  ],
  tokyo: [
    {
      url: 'https://pettena.jp/blogs/pet-outings/dog-events-tokyo',
      name: 'PETTENA Tokyo',
      language: 'ja',
      linkPattern: 'pettena\\.jp/.+',
      maxEvents: 6,
    },
  ],
  sydney: [
    {
      url: 'https://www.australiandoglover.com/p/2026-dog-events-australia-calendar.html',
      name: 'Australian Dog Lover',
      language: 'en',
      linkPattern: 'australiandoglover\\.com/.+',
      maxEvents: 6,
    },
    {
      url: 'https://whatson.cityofsydney.nsw.gov.au/tags/dog-friendly',
      name: 'City of Sydney What\'s On',
      language: 'en',
      linkPattern: 'whatson\\.cityofsydney.+/events/',
      maxEvents: 6,
    },
    {
      url: 'https://petcarecommunity.com.au/pet-events/',
      name: 'Pet Care Community AU',
      language: 'en',
      linkPattern: 'petcarecommunity\\.com\\.au/pet-events/[\\w-]+',
      maxEvents: 8,
    },
  ],
  geneva: [
    {
      url: 'https://www.eventbrite.com/d/switzerland--geneva/dog-events/',
      name: 'Eventbrite Geneva Dogs',
      language: 'en',
      linkPattern: '/e/',
      maxEvents: 6,
    },
    {
      url: 'https://www.bringfido.com/event/country/switzerland/',
      name: 'BringFido Switzerland',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 6,
      isAggregator: true,
    },
  ],
};

// ─── Link Extraction ─────────────────────────────────────────────────────────

/**
 * Extract event/article links from a listing page's HTML.
 * Returns unique absolute URLs matching the source's link pattern.
 */
export function extractEventLinks(html: string, source: CuratedSource): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  const seen = new Set<string>();
  let match;

  // Build the pattern regex from the source config
  const pattern = new RegExp(source.linkPattern, 'i');

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];

    // Skip anchors, JS, mailto, media files, and common non-event paths
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    if (/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|pdf)(\?|$)/i.test(href)) continue;
    if (/\/(feed|rss|comments\/feed|wp-json|wp-admin|wp-content|wp-includes|tag\/|category\/|author\/|page\/\d|login|signup|cart|checkout)\b/i.test(href)) continue;

    // Make absolute
    if (href.startsWith('/')) {
      try {
        const baseUrl = new URL(source.url);
        href = `${baseUrl.protocol}//${baseUrl.host}${href}`;
      } catch { continue; }
    }

    // Must match the source's link pattern
    if (!pattern.test(href)) continue;

    // Must not be the listing page itself
    if (href === source.url) continue;

    // Deduplicate
    const normalized = href.split('?')[0].split('#')[0]; // strip query/hash
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    links.push(href);
  }

  return links.slice(0, source.maxEvents);
}

// ─── AI Event Extraction ─────────────────────────────────────────────────────

export interface ExtractedEvent {
  name: string;
  date: string | null;
  endDate: string | null;
  description: string;
  venueName: string | null;
  venueAddress: string | null;
  isFree: boolean;
  tags: string[];
  externalUrl: string;
  city: string;
  source: string;
  language: string;
}

/**
 * Use GPT-4o-mini to extract structured event data from page text.
 * Returns null if the page doesn't contain an actual event.
 *
 * When isAggregator is true, the AI also extracts the original event
 * organizer URL (e.g. Eventbrite, Facebook, official website) so we
 * link to the source rather than the competitor aggregator.
 */
export async function extractEventWithAI(
  pageText: string,
  pageUrl: string,
  citySlug: string,
  sourceName: string,
  language: string,
  openaiKey: string,
  isAggregator: boolean = false,
): Promise<ExtractedEvent | null> {
  // Truncate to ~4000 chars for better date/venue extraction
  const truncated = pageText.substring(0, 4000);

  const today = new Date().toISOString().split('T')[0];

  const aggregatorInstructions = isAggregator ? `
- official_url: The ORIGINAL event organizer's URL (NOT the current page URL). Look for:
  * "Website" or "Visit Website" links (e.g. Eventbrite, Facebook, official event page)
  * Links that go to eventbrite.com, facebook.com/events, meetup.com, or organizer domains
  * Any URL that points to the actual event host rather than this aggregator page
  * Set to null if you cannot find an original source URL
  IMPORTANT: This is critical — we MUST link to the event source, not this aggregator site.` : '';

  const systemPrompt = `You extract structured dog-friendly event data from web pages. Today is ${today}.

Return a JSON object with these fields:
- name: event name in English (translate if needed)
- name_original: event name in original language (if different)
- date: start date as YYYY-MM-DD (null ONLY if truly no date is mentioned anywhere)
- end_date: end date as YYYY-MM-DD (null if single day or not found)
- description: 1-2 sentence English description (max 200 chars)
- venue_name: venue name (null if not found)
- venue_address: venue address (null if not found)
- is_free: boolean
- tags: array of 2-4 relevant tags (e.g. "festival", "adoption", "outdoor", "charity")
- is_dog_event: boolean — true if this is actually a dog/pet-related event
- is_upcoming: boolean — true if the event date is in the future (after ${today})${aggregatorInstructions}

IMPORTANT date extraction tips:
- Look for dates in ANY format: "Jun 14, 2026", "14/06/2026", "June 14", "Saturday June 14th", etc.
- BringFido pages often have dates like "Sat Jun 14 2026" near the event title
- If only a month/day is given without year, assume the next occurrence (2026 or 2027)
- Recurring events (e.g. "every Saturday"): use the next upcoming date

If the page is NOT about a specific event (e.g. it's a general article, business listing, or directory), set is_dog_event to false.
Respond with ONLY the JSON object, no markdown.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Page URL: ${pageUrl}\nCity: ${citySlug}\nLanguage: ${language}\n\nPage content:\n${truncated}` },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[CURATED-SCRAPER] OpenAI error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Parse JSON (handle potential markdown wrapping)
    const jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(jsonStr);

    // Skip non-events and non-dog events
    if (!parsed.is_dog_event) {
      console.log(`[CURATED-SCRAPER] Skipping non-dog-event: "${parsed.name}" from ${pageUrl}`);
      return null;
    }

    if (parsed.is_upcoming === false) {
      console.log(`[CURATED-SCRAPER] Skipping past event: "${parsed.name}"`);
      return null;
    }

    if (!parsed.name) return null;

    // For aggregator sources, we MUST have an original URL — never link to competitors
    let finalUrl = pageUrl;
    if (isAggregator) {
      const officialUrl = parsed.official_url;
      if (officialUrl && typeof officialUrl === 'string' && officialUrl.startsWith('http')) {
        finalUrl = officialUrl;
        console.log(`[CURATED-SCRAPER] Found original source: "${parsed.name}" → ${officialUrl}`);
      } else {
        console.log(`[CURATED-SCRAPER] Skipping aggregator event without original source: "${parsed.name}" (${pageUrl})`);
        return null;
      }
    }

    return {
      name: parsed.name,
      date: parsed.date || null,
      endDate: parsed.end_date || null,
      description: parsed.description || '',
      venueName: parsed.venue_name || null,
      venueAddress: parsed.venue_address || null,
      isFree: !!parsed.is_free,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      externalUrl: finalUrl,
      city: citySlug,
      source: sourceName,
      language,
    };
  } catch (err) {
    console.error(`[CURATED-SCRAPER] AI extraction error for ${pageUrl}:`, err);
    return null;
  }
}

// ─── Main Scraper ────────────────────────────────────────────────────────────

/**
 * Scrape a single curated source: fetch listing → extract links → fetch & parse each event.
 * Returns an array of extracted events.
 */
export async function scrapeCuratedSource(
  source: CuratedSource,
  citySlug: string,
  openaiKey: string,
): Promise<ExtractedEvent[]> {
  console.log(`[CURATED-SCRAPER] Scraping ${source.name} for ${citySlug}: ${source.url}`);

  const events: ExtractedEvent[] = [];

  try {
    // Step 1: Fetch the listing page
    const listingRes = await fetch(source.url, {
      headers: {
        'User-Agent': 'PawCities-EventBot/1.0 (+https://pawcities.com)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!listingRes.ok) {
      console.error(`[CURATED-SCRAPER] Listing fetch failed: ${listingRes.status} for ${source.url}`);
      return [];
    }

    const listingHtml = await listingRes.text();

    // Step 2: Extract event links
    const eventLinks = extractEventLinks(listingHtml, source);
    console.log(`[CURATED-SCRAPER] Found ${eventLinks.length} event links from ${source.name}`);

    if (eventLinks.length === 0) return [];

    // Step 3: Fetch and parse each event page (with concurrency limit of 3)
    const batchSize = 3;
    for (let i = 0; i < eventLinks.length; i += batchSize) {
      const batch = eventLinks.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const pageRes = await fetch(url, {
              headers: {
                'User-Agent': 'PawCities-EventBot/1.0 (+https://pawcities.com)',
                'Accept': 'text/html',
              },
              signal: AbortSignal.timeout(10000),
            });

            if (!pageRes.ok) return null;

            const html = await pageRes.text();
            // Strip scripts/styles first
            let cleaned = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

            let pageContent: string;
            if (source.isAggregator) {
              // For aggregators, preserve href URLs so the AI can find
              // the original event source (e.g. "Website" links)
              pageContent = cleaned
                .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi, ' [LINK: $1] ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            } else {
              // For direct sources, strip all HTML tags
              pageContent = cleaned
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            }

            return extractEventWithAI(pageContent, url, citySlug, source.name, source.language, openaiKey, !!source.isAggregator);
          } catch (err) {
            console.error(`[CURATED-SCRAPER] Page fetch error for ${url}:`, err);
            return null;
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          events.push(result.value);
        }
      }
    }

    console.log(`[CURATED-SCRAPER] Extracted ${events.length} events from ${source.name}`);
    return events;
  } catch (err) {
    console.error(`[CURATED-SCRAPER] Source error for ${source.name}:`, err);
    return [];
  }
}

/**
 * Get today's curated sources for scraping.
 * Rotates sources daily — scrapes 1 source per city per run to stay within budget.
 */
export function getTodaysSources(): Array<{ citySlug: string; source: CuratedSource }> {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const result: Array<{ citySlug: string; source: CuratedSource }> = [];

  for (const [citySlug, sources] of Object.entries(CURATED_SOURCES)) {
    if (sources.length === 0) continue;
    const sourceIndex = dayOfYear % sources.length;
    result.push({ citySlug, source: sources[sourceIndex] });
  }

  return result;
}

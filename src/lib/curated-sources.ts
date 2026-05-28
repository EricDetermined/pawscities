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
}

export const CURATED_SOURCES: Record<string, CuratedSource[]> = {
  losangeles: [
    {
      url: 'https://www.bringfido.com/event/city/los_angeles_ca_us/',
      name: 'BringFido LA',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 8,
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
      url: 'https://www.bringfido.com/event/city/new_york_ny_us/',
      name: 'BringFido NYC',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 8,
    },
    {
      url: 'https://www.eventbrite.com/d/ny--new-york/dog-events/',
      name: 'Eventbrite NYC Dogs',
      language: 'en',
      linkPattern: '/e/',
      maxEvents: 8,
    },
  ],
  london: [
    {
      url: 'https://thedogvine.com/whats-on/',
      name: 'The Dogvine London',
      language: 'en',
      linkPattern: 'thedogvine\\.com/.+',
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
      url: 'https://www.bringfido.com/event/country/france/',
      name: 'BringFido France',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 6,
    },
  ],
  barcelona: [
    {
      url: 'https://www.bringfido.com/attraction/city/barcelona_es/',
      name: 'BringFido Barcelona',
      language: 'en',
      linkPattern: '/event/\\d+|/attraction/\\d+',
      maxEvents: 6,
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
  ],
  geneva: [
    {
      url: 'https://www.bringfido.com/event/country/switzerland/',
      name: 'BringFido Switzerland',
      language: 'en',
      linkPattern: '/event/\\d+',
      maxEvents: 6,
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

    // Skip anchors, JS, mailto, media files
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    if (/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|pdf)(\?|$)/i.test(href)) continue;

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
 */
export async function extractEventWithAI(
  pageText: string,
  pageUrl: string,
  citySlug: string,
  sourceName: string,
  language: string,
  openaiKey: string,
): Promise<ExtractedEvent | null> {
  // Truncate to ~3000 chars to stay within budget
  const truncated = pageText.substring(0, 3000);

  const systemPrompt = `You extract structured dog-friendly event data from web pages.
Return a JSON object with these fields:
- name: event name in English (translate if needed)
- name_original: event name in original language (if different)
- date: start date as YYYY-MM-DD (null if not found)
- end_date: end date as YYYY-MM-DD (null if single day or not found)
- description: 1-2 sentence English description (max 200 chars)
- venue_name: venue name (null if not found)
- venue_address: venue address (null if not found)
- is_free: boolean
- tags: array of 2-4 relevant tags (e.g. "festival", "adoption", "outdoor", "charity")
- is_dog_event: boolean — true if this is actually a dog/pet-related event
- is_upcoming: boolean — true if the event date is in the future (after May 2026)

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

    return {
      name: parsed.name,
      date: parsed.date || null,
      endDate: parsed.end_date || null,
      description: parsed.description || '',
      venueName: parsed.venue_name || null,
      venueAddress: parsed.venue_address || null,
      isFree: !!parsed.is_free,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      externalUrl: pageUrl,
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
            // Strip HTML tags to get plain text for AI
            const plainText = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            return extractEventWithAI(plainText, url, citySlug, source.name, source.language, openaiKey);
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

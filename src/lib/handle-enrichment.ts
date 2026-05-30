/**
 * Instagram Handle Enrichment Library
 *
 * 5-step waterfall to find Instagram handles for event venues:
 * 1. Cache check — have we looked this venue up before?
 * 2. DB match — does the venue match an existing establishment?
 * 3. Google Places — look up the venue to get its website URL
 * 4. Website scrape — parse the website HTML for Instagram links
 * 5. Web search fallback — search "[venue] [city] instagram"
 *
 * At each step, if a valid handle is found, the waterfall stops.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { searchPlace } from '@/lib/google-places';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  handle: string | null;
  source: 'cache' | 'db_match' | 'google_places_website' | 'website_scrape' | 'web_search' | null;
  confidence: number; // 0-100
  establishmentId: string | null;
  websiteUrl: string | null;
  googlePlaceId: string | null;
}

interface EventToEnrich {
  id: string;
  venue_name: string | null;
  venue_address: string | null;
  city_id: string;
  source_handle: string | null;
  mentioned_handles: string[] | null;
}

// ─── Handle Validation ─────────────────────────────────────────────────────

const HANDLE_BLOCKLIST = new Set([
  'instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin',
  'explore', 'accounts', 'about', 'developer', 'p', 'reel', 'reels',
  'stories', 'direct', 'tv', 'tags', 'locations', 'legal', 'privacy',
  'terms', 'help', 'safety', 'thepawcities', 'pawcities',
  'unknown', 'google_events', 'curated_scrape', 'admin',
]);

export function isValidInstagramHandle(handle: string): boolean {
  // Strip leading @
  const clean = handle.replace(/^@/, '');
  if (!clean) return false;

  // 1-30 chars, alphanumeric + periods + underscores
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) return false;

  // Must not start or end with period
  if (clean.startsWith('.') || clean.endsWith('.')) return false;

  // Must not be in blocklist
  if (HANDLE_BLOCKLIST.has(clean.toLowerCase())) return false;

  // Must not be too short (likely abbreviation noise)
  if (clean.length < 3) return false;

  return true;
}

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, '').replace(/\/$/, '').trim().toLowerCase();
}

// ─── Step 1: Cache Check ────────────────────────────────────────────────────

async function checkCache(
  venueName: string,
  city: string | null,
  supabase: SupabaseClient,
): Promise<EnrichmentResult | null> {
  // Look for exact or very similar venue name in cache
  const normalizedName = venueName.toLowerCase().trim();

  let query = supabase
    .from('instagram_handle_cache')
    .select('*')
    .ilike('venue_name', normalizedName)
    .order('confidence', { ascending: false })
    .limit(1);

  if (city) {
    query = query.eq('city', city);
  }

  const { data } = await query;

  if (data && data.length > 0 && data[0].instagram_handle && data[0].confidence >= 50) {
    return {
      handle: data[0].instagram_handle,
      source: 'cache',
      confidence: data[0].confidence,
      establishmentId: null,
      websiteUrl: data[0].website_url,
      googlePlaceId: data[0].google_place_id,
    };
  }

  return null;
}

// ─── Step 2: DB Match ───────────────────────────────────────────────────────

async function matchEstablishment(
  venueName: string,
  cityId: string,
  supabase: SupabaseClient,
): Promise<EnrichmentResult | null> {
  // Use prefix matching on establishment names within the same city
  const searchPrefix = venueName.substring(0, 20).replace(/[%_]/g, '');

  const { data: candidates } = await supabase
    .from('establishments')
    .select('id, name, website, google_place_id, instagram_handle')
    .eq('city_id', cityId)
    .ilike('name', `%${searchPrefix}%`)
    .limit(10);

  if (!candidates || candidates.length === 0) return null;

  // Fuzzy match: normalize and compare
  const normalizedVenue = venueName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  for (const est of candidates) {
    const normalizedEst = est.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

    // Check similarity
    const isSimilar =
      normalizedEst === normalizedVenue ||
      normalizedEst.includes(normalizedVenue) ||
      normalizedVenue.includes(normalizedEst) ||
      (normalizedVenue.length >= 10 && normalizedEst.substring(0, 15) === normalizedVenue.substring(0, 15));

    if (isSimilar) {
      // Found a match — does it already have an instagram handle?
      if (est.instagram_handle && isValidInstagramHandle(est.instagram_handle)) {
        return {
          handle: cleanHandle(est.instagram_handle),
          source: 'db_match',
          confidence: 90,
          establishmentId: est.id,
          websiteUrl: est.website,
          googlePlaceId: est.google_place_id,
        };
      }

      // Match found but no handle — return partial result for downstream steps
      return {
        handle: null,
        source: 'db_match',
        confidence: 0,
        establishmentId: est.id,
        websiteUrl: est.website,
        googlePlaceId: est.google_place_id,
      };
    }
  }

  return null;
}

// ─── Step 3: Google Places Lookup ───────────────────────────────────────────

async function lookupGooglePlaces(
  venueName: string,
  cityName: string,
): Promise<{ websiteUrl: string | null; googlePlaceId: string | null }> {
  try {
    const result = await searchPlace(`${venueName} ${cityName}`);
    if (result) {
      return {
        websiteUrl: result.websiteUri || null,
        googlePlaceId: result.id || null,
      };
    }
  } catch (err) {
    console.error(`[ENRICH] Google Places lookup failed for "${venueName}":`, err);
  }
  return { websiteUrl: null, googlePlaceId: null };
}

// ─── Step 4: Website Scrape ─────────────────────────────────────────────────

const INSTAGRAM_URL_PATTERNS = [
  // Match full instagram URLs in href attributes
  /href=["']https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?["']/gi,
  /href=["']https?:\/\/(?:www\.)?instagr\.am\/([a-zA-Z0-9_.]+)\/?["']/gi,
  // Match instagram URLs in text/content
  /instagram\.com\/([a-zA-Z0-9_.]+)\/?(?:\s|"|'|<|$)/gi,
];

async function scrapeWebsiteForInstagram(websiteUrl: string): Promise<string | null> {
  const pagesToTry = [websiteUrl];

  // Also try /contact and /about pages
  try {
    const base = new URL(websiteUrl);
    pagesToTry.push(`${base.origin}/contact`);
    pagesToTry.push(`${base.origin}/about`);
  } catch {
    // Invalid URL
  }

  for (const url of pagesToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PawCities/1.0)',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) continue;

      const html = await response.text();
      // Limit to first 200KB to avoid memory issues
      const truncated = html.substring(0, 200000);

      // Extract handles from all patterns
      const foundHandles = new Set<string>();

      for (const pattern of INSTAGRAM_URL_PATTERNS) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(truncated)) !== null) {
          const handle = cleanHandle(match[1]);
          if (isValidInstagramHandle(handle)) {
            foundHandles.add(handle);
          }
        }
      }

      if (foundHandles.size > 0) {
        // Return the first valid handle found
        // If multiple found, prefer the one that appears most frequently
        const handleCounts = new Map<string, number>();
        for (const h of foundHandles) {
          const regex = new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const matches = truncated.match(regex);
          handleCounts.set(h, matches?.length || 1);
        }

        const sorted = [...handleCounts.entries()].sort((a, b) => b[1] - a[1]);
        return sorted[0][0];
      }
    } catch {
      // Timeout, network error, etc — try next page
      continue;
    }
  }

  return null;
}

// ─── Step 5: Web Search Fallback ────────────────────────────────────────────

async function searchWebForInstagram(
  venueName: string,
  cityName: string,
): Promise<string | null> {
  try {
    // Use DuckDuckGo HTML search (more tolerant of automated requests)
    const query = encodeURIComponent(`${venueName} ${cityName} instagram`);
    const url = `https://html.duckduckgo.com/html/?q=${query}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PawCities/1.0)',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Look for instagram.com profile links in search results
    const igLinkPattern = /instagram\.com\/([a-zA-Z0-9_.]+)\/?/gi;
    const foundHandles = new Set<string>();
    let match;

    while ((match = igLinkPattern.exec(html)) !== null) {
      const handle = cleanHandle(match[1]);
      if (isValidInstagramHandle(handle)) {
        foundHandles.add(handle);
      }
    }

    if (foundHandles.size > 0) {
      // Return the first valid handle (most prominent in search results)
      return [...foundHandles][0];
    }
  } catch {
    // Search failed — this is a fallback, so just return null
  }

  return null;
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

export async function enrichEventHandle(
  event: EventToEnrich,
  supabase: SupabaseClient,
  cityName: string,
): Promise<EnrichmentResult> {
  const venueName = event.venue_name;
  if (!venueName || venueName.trim().length < 3) {
    return { handle: null, source: null, confidence: 0, establishmentId: null, websiteUrl: null, googlePlaceId: null };
  }

  const cleanVenue = venueName.trim();
  let websiteUrl: string | null = null;
  let googlePlaceId: string | null = null;
  let establishmentId: string | null = null;

  // ─── STEP 1: Cache ────────────────────────────────────────────────
  const cached = await checkCache(cleanVenue, cityName, supabase);
  if (cached?.handle) {
    console.log(`[ENRICH] Cache hit for "${cleanVenue}" → @${cached.handle}`);
    return cached;
  }

  // ─── STEP 2: DB Match ─────────────────────────────────────────────
  const dbMatch = await matchEstablishment(cleanVenue, event.city_id, supabase);
  if (dbMatch) {
    establishmentId = dbMatch.establishmentId;
    websiteUrl = dbMatch.websiteUrl;
    googlePlaceId = dbMatch.googlePlaceId;

    if (dbMatch.handle) {
      console.log(`[ENRICH] DB match for "${cleanVenue}" → @${dbMatch.handle} (est: ${establishmentId})`);
      return dbMatch;
    }
    console.log(`[ENRICH] DB match for "${cleanVenue}" (est: ${establishmentId}) — no handle yet, continuing...`);
  }

  // ─── STEP 3: Google Places ────────────────────────────────────────
  if (!websiteUrl) {
    const places = await lookupGooglePlaces(cleanVenue, cityName);
    websiteUrl = places.websiteUrl;
    googlePlaceId = googlePlaceId || places.googlePlaceId;

    if (websiteUrl) {
      console.log(`[ENRICH] Google Places found website for "${cleanVenue}": ${websiteUrl}`);
    }
  }

  // ─── STEP 4: Website Scrape ───────────────────────────────────────
  if (websiteUrl) {
    const handle = await scrapeWebsiteForInstagram(websiteUrl);
    if (handle) {
      console.log(`[ENRICH] Website scrape found @${handle} for "${cleanVenue}" from ${websiteUrl}`);
      return {
        handle,
        source: 'website_scrape',
        confidence: 80,
        establishmentId,
        websiteUrl,
        googlePlaceId,
      };
    }
  }

  // ─── STEP 5: Web Search Fallback ──────────────────────────────────
  const searchHandle = await searchWebForInstagram(cleanVenue, cityName);
  if (searchHandle) {
    console.log(`[ENRICH] Web search found @${searchHandle} for "${cleanVenue}"`);
    return {
      handle: searchHandle,
      source: 'web_search',
      confidence: 60,
      establishmentId,
      websiteUrl,
      googlePlaceId,
    };
  }

  // ─── No handle found ─────────────────────────────────────────────
  console.log(`[ENRICH] No handle found for "${cleanVenue}" in ${cityName}`);
  return {
    handle: null,
    source: null,
    confidence: 0,
    establishmentId,
    websiteUrl,
    googlePlaceId,
  };
}

// ─── Cache Storage ──────────────────────────────────────────────────────────

export async function storeInCache(
  venueName: string,
  city: string | null,
  result: EnrichmentResult,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    await supabase.from('instagram_handle_cache').upsert(
      {
        venue_name: venueName.toLowerCase().trim(),
        city: city,
        instagram_handle: result.handle,
        website_url: result.websiteUrl,
        google_place_id: result.googlePlaceId,
        source: result.source || 'not_found',
        confidence: result.confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'venue_name,city' },
    );
  } catch (err) {
    // Non-blocking — cache failure shouldn't stop enrichment
    console.error('[ENRICH] Cache store failed:', err);
  }
}

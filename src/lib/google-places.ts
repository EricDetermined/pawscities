// Google Places API (New) client for Paw Cities
// Uses the newer places.googleapis.com endpoint

// Read at request time, not build time
function getApiKey() { return process.env.GOOGLE_PLACES_API_KEY || ''; }
const BASE_URL = 'https://places.googleapis.com/v1';

interface PlaceSearchResult {
  id: string;
  displayName: { text: string; languageCode: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  priceLevel?: string;
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  regularOpeningHours?: {
    weekdayDescriptions: string[];
    openNow?: boolean;
  };
  googleMapsUri?: string;
}

interface TextSearchResponse {
  places?: PlaceSearchResult[];
}

const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'internationalPhoneNumber',
  'websiteUri',
  'priceLevel',
  'photos',
  'regularOpeningHours',
  'googleMapsUri',
];

/**
 * Minimum name-similarity score required to treat a Google Places hit as the
 * venue we actually asked for. Text search always returns *something* for a
 * plausible query, so without this check a venue that no longer exists (or was
 * never real) silently binds to the nearest similar-sounding business.
 */
export const DEFAULT_MIN_NAME_SCORE = 0.6;

function normalizeName(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: "Republique" <- "Republique"
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function bigramCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < value.length - 1; i++) {
    const gram = value.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  return counts;
}

/** Sørensen–Dice coefficient over character bigrams. */
function diceCoefficient(a: string, b: string): number {
  const A = bigramCounts(a);
  const B = bigramCounts(b);
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  let sizeA = 0;
  let sizeB = 0;
  for (const n of A.values()) sizeA += n;
  for (const n of B.values()) sizeB += n;
  for (const [gram, countA] of A) {
    const countB = B.get(gram);
    if (countB) intersection += Math.min(countA, countB);
  }
  return (2 * intersection) / (sizeA + sizeB);
}

/**
 * Score 0..1 for how well the name Google returned matches the name we asked
 * for. Full token containment scores highly so legitimate suffixes still pass
 * ("Galeries Lafayette" vs "Galeries Lafayette Haussmann").
 */
export function nameMatchScore(requested: string, returned: string): number {
  const a = normalizeName(requested);
  const b = normalizeName(returned);
  if (!a || !b) return 0;
  if (a === b) return 1;

  let score = diceCoefficient(a.replace(/ /g, ''), b.replace(/ /g, ''));

  const tokensA = a.split(' ');
  const tokensB = b.split(' ');
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const aInB = tokensA.every((t) => setB.has(t));
  const bInA = tokensB.every((t) => setA.has(t));
  if (aInB || bInA) score = Math.max(score, 0.85);

  return score;
}

/**
 * True when the two names share no comparable script (e.g. an English query
 * against a Japanese displayName). Similarity is meaningless here, so callers
 * should route these to manual review rather than auto-rejecting them.
 */
export function isCrossScriptComparison(requested: string, returned: string): boolean {
  const latin = /\p{Script=Latin}/u;
  return latin.test(requested || '') && !latin.test(returned || '');
}

export async function searchPlaces(
  query: string,
  locationBias?: { lat: number; lng: number },
  maxResultCount: number = 5
): Promise<PlaceSearchResult[]> {
  const fieldMask = PLACE_FIELDS.map((f) => `places.${f}`).join(',');

  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount,
    languageCode: 'en',
  };

  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: 20000, // 20km radius
      },
    };
  }

  const response = await fetch(`${BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Places API error for "${query}":`, response.status, errorText);
    return [];
  }

  const data: TextSearchResponse = await response.json();
  return data.places || [];
}

/** Back-compat wrapper: returns the single best text-search hit, unvalidated. */
export async function searchPlace(
  query: string,
  locationBias?: { lat: number; lng: number }
): Promise<PlaceSearchResult | null> {
  const results = await searchPlaces(query, locationBias, 1);
  return results[0] || null;
}

/**
 * Fetch a place directly by its Google Place ID. Used when an entry has a
 * curated/pinned googlePlaceId so refreshes never re-run a fuzzy text search.
 */
export async function getPlaceById(placeId: string): Promise<PlaceSearchResult | null> {
  const response = await fetch(`${BASE_URL}/places/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': PLACE_FIELDS.join(','),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Places API error for id "${placeId}":`, response.status, errorText);
    return null;
  }

  return (await response.json()) as PlaceSearchResult;
}

export function getPhotoUrl(photoName: string, maxWidth: number = 800): string {
  // Returns a URL that goes through our proxy to avoid exposing the API key
  const encodedName = encodeURIComponent(photoName);
  return `/api/places/photo?name=${encodedName}&maxWidth=${maxWidth}`;
}

export function getDirectPhotoUrl(photoName: string, maxWidth: number = 800): string {
  // Direct Google Places photo URL (for server-side use only)
  return `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${getApiKey()}`;
}

function priceLevelToNumber(priceLevel?: string): number {
  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE': return 1;
    case 'PRICE_LEVEL_INEXPENSIVE': return 1;
    case 'PRICE_LEVEL_MODERATE': return 2;
    case 'PRICE_LEVEL_EXPENSIVE': return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
    default: return 2;
  }
}

export interface EnrichedPlace {
  name: string;
  googlePlaceId: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  phone?: string;
  website?: string;
  priceLevel: number;
  photoRefs: string[]; // photo name references for the proxy
  googleMapsUrl?: string;
  openingHours?: string[];
  matched: boolean;
  /** Similarity between the requested name and the name Google returned. */
  nameScore?: number;
  /** Set when the best hit was too weak to trust; surfaced for manual review. */
  rejectedCandidate?: { name: string; googlePlaceId: string; address: string };
  /** True when requested/returned names use different scripts and cannot be compared. */
  needsManualReview?: boolean;
}

function toEnrichedPlace(result: PlaceSearchResult, fallbackName: string): EnrichedPlace {
  return {
    name: result.displayName?.text || fallbackName,
    googlePlaceId: result.id,
    address: result.formattedAddress || '',
    latitude: result.location?.latitude || 0,
    longitude: result.location?.longitude || 0,
    rating: result.rating || 0,
    reviewCount: result.userRatingCount || 0,
    phone: result.internationalPhoneNumber,
    website: result.websiteUri,
    priceLevel: priceLevelToNumber(result.priceLevel),
    photoRefs: (result.photos || []).slice(0, 3).map(p => p.name),
    googleMapsUrl: result.googleMapsUri,
    openingHours: result.regularOpeningHours?.weekdayDescriptions,
    matched: true,
  };
}

export interface EnrichOptions {
  /** Pinned Google Place ID — skips text search entirely. */
  googlePlaceId?: string;
  /** Override the name-similarity floor. */
  minNameScore?: number;
}

export async function enrichPlace(
  placeName: string,
  cityName: string,
  category: string,
  locationBias?: { lat: number; lng: number },
  options: EnrichOptions = {}
): Promise<EnrichedPlace | null> {
  const minNameScore = options.minNameScore ?? DEFAULT_MIN_NAME_SCORE;

  // Curated entries refresh by ID so they can never drift onto another venue.
  if (options.googlePlaceId) {
    const pinned = await getPlaceById(options.googlePlaceId);
    if (pinned) return { ...toEnrichedPlace(pinned, placeName), nameScore: 1 };
    console.warn(`Pinned place ID ${options.googlePlaceId} for "${placeName}" no longer resolves`);
    return null;
  }

  // Build search query: place name + city + optionally category for better matching
  const query = `${placeName} ${cityName} ${category}`;

  const results = await searchPlaces(query, locationBias, 5);
  if (results.length === 0) return null;

  // Pick the best candidate by name, not just whatever ranked first.
  let best = results[0];
  let bestScore = -1;
  for (const candidate of results) {
    const s = nameMatchScore(placeName, candidate.displayName?.text || '');
    if (s > bestScore) {
      bestScore = s;
      best = candidate;
    }
  }

  const bestName = best.displayName?.text || '';

  // English query against a non-Latin display name: similarity is meaningless,
  // so accept it but flag for a human rather than silently dropping the venue.
  if (bestScore < minNameScore && isCrossScriptComparison(placeName, bestName)) {
    return {
      ...toEnrichedPlace(best, placeName),
      nameScore: bestScore,
      needsManualReview: true,
    };
  }

  if (bestScore < minNameScore) {
    return {
      ...toEnrichedPlace(best, placeName),
      matched: false,
      nameScore: bestScore,
      rejectedCandidate: {
        name: bestName,
        googlePlaceId: best.id,
        address: best.formattedAddress || '',
      },
    };
  }

  return { ...toEnrichedPlace(best, placeName), nameScore: bestScore };
}

// Google Places API (New) client for Paw Cities
// Uses the newer places.googleapis.com endpoint

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
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

export async function searchPlace(query: string, locationBias?: { lat: number; lng: number }): Promise<PlaceSearchResult | null> {
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.priceLevel',
    'places.photos',
    'places.regularOpeningHours',
    'places.googleMapsUri',
  ].join(',');

  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 1,
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
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Places API error for "${query}":`, response.status, errorText);
    return null;
  }

  const data: TextSearchResponse = await response.json();
  return data.places?.[0] || null;
}

export function getPhotoUrl(photoName: string, maxWidth: number = 800): string {
  // Returns a URL that goes through our proxy to avoid exposing the API key
  const encodedName = encodeURIComponent(photoName);
  return `/api/places/photo?name=${encodedName}&maxWidth=${maxWidth}`;
}

export function getDirectPhotoUrl(photoName: string, maxWidth: number = 800): string {
  // Direct Google Places photo URL (for server-side use only)
  return `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`;
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
}

export async function enrichPlace(
  placeName: string,
  cityName: string,
  category: string,
  locationBias?: { lat: number; lng: number }
): Promise<EnrichedPlace | null> {
  // Build search query: place name + city + optionally category for better matching
  const query = `${placeName} ${cityName} ${category}`;

  const result = await searchPlace(query, locationBias);
  if (!result) return null;

  return {
    name: result.displayName?.text || placeName,
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

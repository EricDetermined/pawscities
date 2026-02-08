import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { enrichPlace } from '@/lib/google-places';

const CITY_DATA_MAP: Record<string, { file: string; cityName: string; lat: number; lng: number }> = {
  geneva: { file: 'geneva-places', cityName: 'Geneva Switzerland', lat: 46.2044, lng: 6.1432 },
  paris: { file: 'paris-places', cityName: 'Paris France', lat: 48.8566, lng: 2.3522 },
  london: { file: 'london-places', cityName: 'London UK', lat: 51.5074, lng: -0.1278 },
  losangeles: { file: 'los-angeles-places', cityName: 'Los Angeles California', lat: 34.0522, lng: -118.2437 },
  newyork: { file: 'nyc-places', cityName: 'New York City', lat: 40.7128, lng: -74.0060 },
  barcelona: { file: 'barcelona-places', cityName: 'Barcelona Spain', lat: 41.3851, lng: 2.1734 },
  sydney: { file: 'sydney-places', cityName: 'Sydney Australia', lat: -33.8688, lng: 151.2093 },
  tokyo: { file: 'tokyo-places', cityName: 'Tokyo Japan', lat: 35.6762, lng: 139.6503 },
};

interface RawPlace {
  name: string;
  nameFr?: string;
  category: string;
  address: string;
  neighborhood?: string;
  phone?: string;
  website?: string;
  description: string;
  descriptionFr?: string;
  dogFeatures: string[] | Record<string, boolean>;
  priceLevel?: number;
  confidence?: number;
  reasoning?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  // New fields from enrichment
  googlePlaceId?: string;
  photoRefs?: string[];
  googleMapsUrl?: string;
  openingHours?: string[];
  enriched?: boolean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const limit = parseInt(searchParams.get('limit') || '5');
  const offset = parseInt(searchParams.get('offset') || '0');
  const dryRun = searchParams.get('dryRun') === 'true';

  if (!city || !CITY_DATA_MAP[city]) {
    return NextResponse.json({
      error: 'Invalid city. Valid cities: ' + Object.keys(CITY_DATA_MAP).join(', '),
    }, { status: 400 });
  }

  const cityConfig = CITY_DATA_MAP[city];

  try {
    // Load existing data
    const filePath = path.join(process.cwd(), 'research-output', `${cityConfig.file}.json`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    const places: RawPlace[] = data.places || [];

    // Get the slice to enrich
    const toEnrich = places.slice(offset, offset + limit);

    if (dryRun) {
      return NextResponse.json({
        city,
        totalPlaces: places.length,
        offset,
        limit,
        toEnrich: toEnrich.map(p => ({ name: p.name, category: p.category, enriched: !!p.enriched })),
      });
    }

    const results = [];

    for (const place of toEnrich) {
      // Skip already enriched places
      if (place.enriched) {
        results.push({ name: place.name, status: 'already_enriched', skipped: true });
        continue;
      }

      try {
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

        const enriched = await enrichPlace(
          place.name,
          cityConfig.cityName,
          place.category,
          { lat: cityConfig.lat, lng: cityConfig.lng }
        );

        if (enriched && enriched.matched) {
          // Update the place with real data
          const placeIndex = places.findIndex(p => p.name === place.name);
          if (placeIndex !== -1) {
            places[placeIndex] = {
              ...places[placeIndex],
              latitude: enriched.latitude,
              longitude: enriched.longitude,
              rating: enriched.rating || places[placeIndex].rating,
              reviewCount: enriched.reviewCount || places[placeIndex].reviewCount,
              phone: enriched.phone || places[placeIndex].phone,
              website: enriched.website || places[placeIndex].website,
              googlePlaceId: enriched.googlePlaceId,
              photoRefs: enriched.photoRefs,
              googleMapsUrl: enriched.googleMapsUrl,
              openingHours: enriched.openingHours,
              priceLevel: enriched.priceLevel || places[placeIndex].priceLevel,
              enriched: true,
            };
          }

          results.push({
            name: place.name,
            status: 'enriched',
            googleName: enriched.name,
            rating: enriched.rating,
            reviewCount: enriched.reviewCount,
            photos: enriched.photoRefs.length,
            coordinates: { lat: enriched.latitude, lng: enriched.longitude },
          });
        } else {
          results.push({ name: place.name, status: 'not_found' });
        }
      } catch (err) {
        results.push({ name: place.name, status: 'error', error: String(err) });
      }
    }

    // Save enriched data back to file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({
      city,
      totalPlaces: places.length,
      enrichedInThisBatch: results.filter(r => r.status === 'enriched').length,
      offset,
      limit,
      nextOffset: offset + limit < places.length ? offset + limit : null,
      results,
    });
  } catch (error) {
    console.error('Enrichment error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

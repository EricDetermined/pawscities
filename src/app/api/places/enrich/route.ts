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
  category: string;
  address: string;
  [key: string]: unknown;
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
    // Load existing data (read-only on Vercel)
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
        toEnrich: toEnrich.map(p => ({ name: p.name, category: p.category })),
      });
    }

    // Enrich each place and return results (don't write to disk - Vercel is read-only)
    const enrichedPlaces = [];

    for (const place of toEnrich) {
      try {
        await new Promise(resolve => setTimeout(resolve, 200));

        const enriched = await enrichPlace(
          place.name,
          cityConfig.cityName,
          place.category,
          { lat: cityConfig.lat, lng: cityConfig.lng }
        );

        if (enriched && enriched.matched) {
          enrichedPlaces.push({
            originalName: place.name,
            googleName: enriched.name,
            googlePlaceId: enriched.googlePlaceId,
            address: enriched.address,
            latitude: enriched.latitude,
            longitude: enriched.longitude,
            rating: enriched.rating,
            reviewCount: enriched.reviewCount,
            phone: enriched.phone,
            website: enriched.website,
            priceLevel: enriched.priceLevel,
            photoRefs: enriched.photoRefs,
            googleMapsUrl: enriched.googleMapsUrl,
            openingHours: enriched.openingHours,
            status: 'matched',
          });
        } else {
          enrichedPlaces.push({
            originalName: place.name,
            status: 'not_found',
          });
        }
      } catch (err) {
        enrichedPlaces.push({
          originalName: place.name,
          status: 'error',
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      city,
      totalPlaces: places.length,
      offset,
      limit,
      enrichedCount: enrichedPlaces.filter(p => p.status === 'matched').length,
      nextOffset: offset + limit < places.length ? offset + limit : null,
      places: enrichedPlaces,
    });
  } catch (error) {
    console.error('Enrichment error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

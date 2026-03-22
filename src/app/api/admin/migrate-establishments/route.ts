import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 300; // 5 minutes

const CITY_FILE_MAP: Record<string, string> = {
  paris: 'paris-places',
  geneva: 'geneva-places',
  london: 'london-places',
  barcelona: 'barcelona-places',
  'los-angeles': 'los-angeles-places',
  nyc: 'nyc-places',
  sydney: 'sydney-places',
  tokyo: 'tokyo-places',
};

// Normalize category from research data to DB category slugs
function normalizeCategory(cat: string): string {
  const lower = cat.toLowerCase().trim();
  const map: Record<string, string> = {
    park: 'parks', parks: 'parks',
    restaurant: 'restaurants', restaurants: 'restaurants',
    cafe: 'cafes', cafes: 'cafes',
    hotel: 'hotels', hotels: 'hotels',
    beach: 'beaches', beaches: 'beaches',
    vet: 'vets', vets: 'vets',
    groomer: 'groomers', groomers: 'groomers',
    shop: 'shops', shops: 'shops', 'pet shop': 'shops',
    pub: 'restaurants', pubs: 'restaurants', bar: 'restaurants',
  };
  if (map[lower]) return map[lower];
  if (lower.includes('beach')) return 'beaches';
  if (lower.includes('park')) return 'parks';
  if (lower.includes('restaurant') || lower.includes('pub') || lower.includes('brunch')) return 'restaurants';
  if (lower.includes('cafe') || lower.includes('coffee')) return 'cafes';
  if (lower.includes('hotel') || lower.includes('hostel')) return 'hotels';
  if (lower.includes('vet') || lower.includes('clinic')) return 'vets';
  if (lower.includes('groom')) return 'groomers';
  if (lower.includes('shop') || lower.includes('store')) return 'shops';
  return 'restaurants';
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

interface RawPlace {
  name: string;
  category: string;
  address: string;
  neighborhood?: string;
  phone?: string;
  website?: string;
  description: string;
  descriptionFr?: string;
  dogFeatures?: string[] | Record<string, boolean>;
  priceLevel?: number;
  confidence?: number;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  googlePlaceId?: string;
  photoRefs?: string[];
  googleMapsUrl?: string;
  openingHours?: string[];
}

/**
 * POST /api/admin/migrate-establishments?secret=CRON_SECRET
 *
 * Migrates all establishments from research JSON files into Supabase.
 * Skips any that already exist (by slug within the same city).
 * Updates existing ones if they have a google_place_id match.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: { city: string; inserted: number; updated: number; skipped: number; errors: number }[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Load all categories for ID lookup
  const { data: categories } = await supabase.from('categories').select('id, slug');
  const categoryIdMap: Record<string, string> = {};
  (categories || []).forEach((c: { id: string; slug: string }) => { categoryIdMap[c.slug] = c.id; });

  // Load all cities for ID lookup
  const { data: cities } = await supabase.from('cities').select('id, slug');
  const cityIdMap: Record<string, string> = {};
  (cities || []).forEach((c: { id: string; slug: string }) => { cityIdMap[c.slug] = c.id; });

  for (const [citySlug, filename] of Object.entries(CITY_FILE_MAP)) {
    const filePath = path.join(process.cwd(), 'research-output', `${filename}.json`);
    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    const cityId = cityIdMap[citySlug];
    if (!cityId) {
      console.error(`City "${citySlug}" not found in cities table`);
      continue;
    }

    let places: RawPlace[];
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      places = data.places || (Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(`Failed to read ${filename}.json:`, e);
      continue;
    }

    // Get existing slugs for this city to detect duplicates
    const { data: existingEstablishments } = await supabase
      .from('establishments')
      .select('id, slug, google_place_id')
      .eq('city_id', cityId);

    const existingBySlug: Record<string, { id: string; google_place_id: string | null }> = {};
    const existingByGoogleId: Record<string, string> = {};
    (existingEstablishments || []).forEach((e: { id: string; slug: string; google_place_id: string | null }) => {
      existingBySlug[e.slug] = { id: e.id, google_place_id: e.google_place_id };
      if (e.google_place_id) existingByGoogleId[e.google_place_id] = e.id;
    });

    for (const place of places) {
      const slug = generateSlug(place.name);
      const catSlug = normalizeCategory(place.category);
      const categoryId = categoryIdMap[catSlug] || null;

      // Parse dog features — handle both array and object formats
      let dogFeatures: Record<string, boolean> = {};
      if (Array.isArray(place.dogFeatures)) {
        place.dogFeatures.forEach(f => { dogFeatures[f] = true; });
      } else if (place.dogFeatures && typeof place.dogFeatures === 'object') {
        dogFeatures = place.dogFeatures as Record<string, boolean>;
      }

      // Build primary image from photo refs
      const primaryImage = place.photoRefs && place.photoRefs.length > 0
        ? `/api/places/photo?name=${encodeURIComponent(place.photoRefs[0])}&maxWidth=800`
        : null;

      const establishmentData = {
        name: place.name,
        slug,
        address: place.address,
        city_id: cityId,
        category_id: categoryId,
        description: place.description,
        status: 'ACTIVE',
        tier: 'free',
        is_verified: (place.confidence || 0) > 90,
        is_featured: false,
        rating: place.rating || 0,
        review_count: place.reviewCount || 0,
        price_level: place.priceLevel || 2,
        phone: place.phone || null,
        website: place.website || null,
        latitude: place.latitude || null,
        longitude: place.longitude || null,
        google_place_id: place.googlePlaceId || null,
        google_maps_url: place.googleMapsUrl || null,
        photo_refs: place.photoRefs || null,
        primary_image: primaryImage,
        dog_features: dogFeatures,
      };

      try {
        // Check if already exists by slug or Google Place ID
        const existingBySlugEntry = existingBySlug[slug];
        const existingByGoogleEntry = place.googlePlaceId ? existingByGoogleId[place.googlePlaceId] : null;
        const existingId = existingBySlugEntry?.id || existingByGoogleEntry;

        if (existingId) {
          // Update existing record with fresh data (photo refs, rating, etc.)
          const { error: updateError } = await supabase
            .from('establishments')
            .update({
              ...establishmentData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);

          if (updateError) {
            console.error(`Failed to update "${place.name}" in ${citySlug}:`, updateError.message);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('establishments')
            .insert(establishmentData);

          if (insertError) {
            // Could be a unique constraint violation — try update instead
            if (insertError.code === '23505') {
              skipped++;
            } else {
              console.error(`Failed to insert "${place.name}" in ${citySlug}:`, insertError.message);
              errors++;
            }
          } else {
            inserted++;
          }
        }
      } catch (e) {
        console.error(`Error processing "${place.name}" in ${citySlug}:`, e);
        errors++;
      }
    }

    totalInserted += inserted;
    totalUpdated += updated;
    totalSkipped += skipped;
    totalErrors += errors;
    results.push({ city: citySlug, inserted, updated, skipped, errors });
    console.log(`${citySlug}: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors} errors`);
  }

  return NextResponse.json({
    success: true,
    message: `Migration complete: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`,
    totalInserted,
    totalUpdated,
    totalSkipped,
    totalErrors,
    results,
    timestamp: new Date().toISOString(),
  });
}

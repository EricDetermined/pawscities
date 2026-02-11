/**
 * Seed script: Import 265 establishments from research-output JSON files
 * into the Supabase establishments table.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-establishments.ts
 *
 * Options:
 *   --dry-run   Preview what will be inserted without writing to DB
 *
 * Requires the SQL migration (001_schema.sql) to have been run first,
 * which seeds the cities and categories tables.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('❌ Missing environment variables.');
  console.error('   Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Or use --dry-run to preview without database connection.');
  process.exit(1);
}

// Only create client when actually writing to DB
let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

const DATA_DIR = path.resolve(__dirname, '..', 'research-output');

const CITY_FILES = [
  'geneva-places.json',
  'paris-places.json',
  'london-places.json',
  'los-angeles-places.json',
  'nyc-places.json',
  'barcelona-places.json',
  'sydney-places.json',
  'tokyo-places.json',
];

// Map from the city filename prefix to the city slug in the DB
const FILE_TO_CITY_SLUG: Record<string, string> = {
  'geneva': 'geneva',
  'paris': 'paris',
  'london': 'london',
  'los-angeles': 'losangeles',
  'nyc': 'newyork',
  'barcelona': 'barcelona',
  'sydney': 'sydney',
  'tokyo': 'tokyo',
};

// Map JSON category values → DB category slugs
const CATEGORY_MAP: Record<string, string> = {
  // Direct matches
  'restaurants': 'restaurants',
  'cafes': 'cafes',
  'hotels': 'hotels',
  'parks': 'parks',
  'beaches': 'beaches',
  'vets': 'vets',
  'groomers': 'groomers',
  'shops': 'shops',
  'activities': 'activities',
  // Singular / alternate names
  'restaurant': 'restaurants',
  'cafe': 'cafes',
  'coffee': 'cafes',
  'hotel': 'hotels',
  'park': 'parks',
  'dog park': 'parks',
  'dog_park': 'parks',
  'beach': 'beaches',
  'vet': 'vets',
  'veterinarian': 'vets',
  'veterinary': 'vets',
  'groomer': 'groomers',
  'grooming': 'groomers',
  'shop': 'shops',
  'pet shop': 'shops',
  'pet_shop': 'shops',
  'pet store': 'shops',
  'pet_store': 'shops',
  'activity': 'activities',
  // UK-specific
  'pubs': 'restaurants',
  'pub': 'restaurants',
  'pub/restaurant': 'restaurants',
  'bar': 'restaurants',
  'bars': 'restaurants',
  // Compound / alternate names found in data
  'cafe/brunch': 'cafes',
  'dog cafe': 'cafes',
  'regular cafe': 'cafes',
  'dog beach/park': 'parks',
  'dog beach': 'beaches',
  'activitie': 'activities',
  'shopping': 'shops',
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Generate a URL-safe slug from a name */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9\s-]/g, '')      // remove special chars
    .replace(/\s+/g, '-')              // spaces → hyphens
    .replace(/-+/g, '-')               // collapse hyphens
    .replace(/^-|-$/g, '');            // trim hyphens
}

/** Normalize dogFeatures to a consistent JSONB object */
function normalizeDogFeatures(features: unknown): Record<string, boolean> {
  if (!features) return {};

  // Already a dict → keep it
  if (typeof features === 'object' && !Array.isArray(features)) {
    const result: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(features as Record<string, unknown>)) {
      result[key] = Boolean(val);
    }
    return result;
  }

  // Array of string feature names → convert to dict
  if (Array.isArray(features)) {
    const result: Record<string, boolean> = {};
    for (const f of features) {
      if (typeof f === 'string') {
        result[f] = true;
      }
    }
    return result;
  }

  return {};
}

/** Resolve a JSON category value to a DB category slug */
function resolveCategory(raw: string): string {
  const normalised = raw.toLowerCase().trim();
  return CATEGORY_MAP[normalised] || 'activities'; // fallback to activities
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

interface RawPlace {
  name: string;
  nameFr?: string;
  nameLocal?: string;
  category: string;
  address: string;
  neighborhood?: string;
  phone?: string;
  website?: string;
  description?: string;
  descriptionFr?: string;
  dogFeatures?: unknown;
  priceLevel?: number;
  confidence?: number;
  reasoning?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  photoRefs?: string[];
  openingHours?: string[] | null;
  enriched?: boolean;
}

interface CityFileData {
  city?: string;
  places: RawPlace[];
}

async function main() {
  console.log('🐾 Paw Cities — Establishment Seed Script');
  if (DRY_RUN) console.log('⚡ DRY RUN MODE — no database writes will be made');
  console.log('==========================================\n');

  // In dry-run mode we use placeholder UUIDs
  const cityIdMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();

  if (DRY_RUN) {
    // Use placeholder IDs for dry run
    const citySlugs = ['geneva', 'paris', 'london', 'losangeles', 'newyork', 'barcelona', 'sydney', 'tokyo'];
    const catSlugs = ['restaurants', 'cafes', 'hotels', 'parks', 'beaches', 'vets', 'groomers', 'shops', 'activities'];
    citySlugs.forEach((s, i) => cityIdMap.set(s, `city-${i}`));
    catSlugs.forEach((s, i) => categoryIdMap.set(s, `cat-${i}`));
    console.log(`📍 Using placeholder city IDs: ${citySlugs.join(', ')}`);
    console.log(`📂 Using placeholder category IDs: ${catSlugs.join(', ')}\n`);
  } else {
    // 1. Fetch city IDs from DB
    console.log('📍 Fetching cities from database...');
    const { data: cities, error: citiesErr } = await getSupabase()
      .from('cities')
      .select('id, slug');

    if (citiesErr || !cities?.length) {
      console.error('❌ Failed to fetch cities. Did you run the SQL migration first?');
      console.error(citiesErr?.message);
      process.exit(1);
    }

    for (const c of cities) {
      cityIdMap.set(c.slug, c.id);
    }
    console.log(`   Found ${cities.length} cities: ${cities.map((c: { slug: string }) => c.slug).join(', ')}\n`);

    // 2. Fetch category IDs from DB
    console.log('📂 Fetching categories from database...');
    const { data: categories, error: catsErr } = await getSupabase()
      .from('categories')
      .select('id, slug');

    if (catsErr || !categories?.length) {
      console.error('❌ Failed to fetch categories. Did you run the SQL migration first?');
      console.error(catsErr?.message);
      process.exit(1);
    }

    for (const c of categories) {
      categoryIdMap.set(c.slug, c.id);
    }
    console.log(`   Found ${categories.length} categories: ${categories.map((c: { slug: string }) => c.slug).join(', ')}\n`);
  }

  // 3. Process each city file
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const unmappedCategories = new Set<string>();

  for (const filename of CITY_FILES) {
    const filePath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filename} — skipping`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const fileData: CityFileData = JSON.parse(raw);
    const places = fileData.places || [];

    // Determine city slug from filename
    const cityPrefix = filename.replace('-places.json', '');
    const citySlug = FILE_TO_CITY_SLUG[cityPrefix] || cityPrefix;
    const cityId = cityIdMap.get(citySlug);

    if (!cityId) {
      console.warn(`⚠️  No city ID found for slug "${citySlug}" — skipping ${filename}`);
      continue;
    }

    console.log(`\n🏙️  Processing ${filename} (${places.length} places, city: ${citySlug})`);

    // Track slugs to detect duplicates within the same city
    const usedSlugs = new Set<string>();

    // Build batch of rows for this city
    const rows = [];

    for (const place of places) {
      // Resolve category
      const catSlug = resolveCategory(place.category);
      const categoryId = categoryIdMap.get(catSlug);

      if (!categoryId) {
        unmappedCategories.add(place.category);
        console.warn(`   ⚠️  Unknown category "${place.category}" (mapped to "${catSlug}") for "${place.name}" — skipping`);
        totalSkipped++;
        continue;
      }

      // Generate unique slug
      let slug = slugify(place.name);
      if (usedSlugs.has(slug)) {
        // Append neighborhood or counter to disambiguate
        const suffix = place.neighborhood ? slugify(place.neighborhood) : String(usedSlugs.size);
        slug = `${slug}-${suffix}`;
      }
      usedSlugs.add(slug);

      // Normalize dog features
      const dogFeatures = normalizeDogFeatures(place.dogFeatures);

      // Clamp price level
      const priceLevel = Math.min(4, Math.max(1, place.priceLevel || 2));

      // Build the row
      rows.push({
        slug,
        city_id: cityId,
        category_id: categoryId,
        name: place.name,
        name_fr: place.nameFr || null,
        description: place.description || null,
        description_fr: place.descriptionFr || null,
        address: place.address,
        neighborhood: place.neighborhood || null,
        latitude: place.latitude || null,
        longitude: place.longitude || null,
        phone: place.phone || null,
        website: place.website || null,
        rating: place.rating || 0,
        review_count: place.reviewCount || 0,
        price_level: priceLevel,
        photo_refs: place.photoRefs || [],
        google_place_id: place.googlePlaceId || null,
        google_maps_url: place.googleMapsUrl || null,
        opening_hours: place.openingHours || [],
        dog_features: dogFeatures,
        status: 'ACTIVE',
        tier: 'free',
        is_verified: false,
        is_featured: false,
        source: 'research',
        confidence: place.confidence || 0,
      });
    }

    // Batch upsert (using slug + city_id unique constraint)
    if (rows.length > 0) {
      if (DRY_RUN) {
        // In dry-run mode, just print a summary per city
        totalInserted += rows.length;
        console.log(`   📋 Would insert/update ${rows.length} establishments`);
        // Show first 3 as sample
        for (const r of rows.slice(0, 3)) {
          console.log(`      • ${r.name} → slug: "${r.slug}", cat: ${r.category_id}`);
        }
        if (rows.length > 3) {
          console.log(`      ... and ${rows.length - 3} more`);
        }
      } else {
        // Insert in batches of 50 to stay under payload limits
        const BATCH_SIZE = 50;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);

          const { data, error } = await getSupabase()
            .from('establishments')
            .upsert(batch, {
              onConflict: 'city_id,slug',
              ignoreDuplicates: false,
            })
            .select('id');

          if (error) {
            console.error(`   ❌ Batch insert error (rows ${i + 1}-${i + batch.length}):`, error.message);
            totalErrors += batch.length;
          } else {
            const count = data?.length || batch.length;
            totalInserted += count;
            console.log(`   ✅ Inserted/updated ${count} establishments (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
          }
        }
      }
    }
  }

  // 4. Summary
  console.log('\n==========================================');
  console.log('📊 SEED SUMMARY');
  console.log('==========================================');
  console.log(`   ✅ Inserted/updated: ${totalInserted}`);
  console.log(`   ⚠️  Skipped:          ${totalSkipped}`);
  console.log(`   ❌ Errors:            ${totalErrors}`);

  if (unmappedCategories.size > 0) {
    console.log(`\n   Unmapped categories encountered: ${Array.from(unmappedCategories).join(', ')}`);
  }

  console.log('\n🐾 Done!\n');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

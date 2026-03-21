import { promises as fs } from 'fs';
import path from 'path';
import { CITIES, type CityConfig } from './cities-config';
import type { Establishment, DogFeatures, CategorySlug } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const CITY_DATA_MAP: Record<string, string> = {
  geneva: 'geneva-places',
  paris: 'paris-places',
  london: 'london-places',
  losangeles: 'los-angeles-places',
  newyork: 'nyc-places',
  barcelona: 'barcelona-places',
  sydney: 'sydney-places',
  tokyo: 'tokyo-places',
};

function hashString(str: string): number {
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV-1a 32-bit prime
  }
  return Math.abs(hash);
}

function seededRandom(seed: string, index: number = 0): number {
  // Use FNV-1a with better entropy: mix seed, index, and add more variation
  const combined = `${seed}:${index}`;
  const hash = hashString(combined);
  // Use modulo with larger divisor for better distribution
  return (hash % 100000) / 100000;
}

function generateCoordinates(cityConfig: CityConfig, placeName: string, category: string = '', placeIndex: number = 0): { lat: number; lng: number } {
  // Use category and placeIndex to ensure independently varied offsets
  // This prevents correlation between latitude and longitude
  const latSeed = `${placeName}:lat:${category}:${placeIndex}`;
  const lngSeed = `${placeName}:lng:${category}:${placeIndex}`;

  const latRandom = seededRandom(latSeed, 0);
  const lngRandom = seededRandom(lngSeed, 1);

  // Use 0.08 degree spread for wider, more realistic distribution
  const latOffset = (latRandom - 0.5) * 0.08;
  const lngOffset = (lngRandom - 0.5) * 0.08;

  return { lat: cityConfig.latitude + latOffset, lng: cityConfig.longitude + lngOffset };
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
const CATEGORY_IMAGES: Record<string, string[]> = {
  parks: [
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1477884213360-7e9d7dcc8f9b?w=800&h=600&fit=crop',
  ],
  restaurants: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=600&fit=crop',
  ],
  cafes: [
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800&h=600&fit=crop',
  ],
  hotels: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop',
  ],
  vets: ['https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=800&h=600&fit=crop'],
  groomers: ['https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&h=600&fit=crop'],
  shops: ['https://images.unsplash.com/photo-1583337130417-13571c4e8ee2?w=800&h=600&fit=crop'],
  activities: ['https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&h=600&fit=crop'],
  beaches: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop'],
  walkers: [
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1450778869180-e77b3aea0511?w=800&h=600&fit=crop',
  ],
  trainers: [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1558929996-da64ba858215?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1546421845-6471bdbb26b1?w=800&h=600&fit=crop',
  ],
  daycare: [
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=600&fit=crop',
  ],
};
function getDefaultImage(category: string, name: string): string {
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES['parks'];
  return images[hashString(name) % images.length];
}

function normalizeCategory(cat: string): CategorySlug {
  // Exact match first (handles simple singular/plural forms)
  const exactMapping: Record<string, CategorySlug> = {
    park: 'parks', parks: 'parks', restaurant: 'restaurants', restaurants: 'restaurants',
    cafe: 'cafes', cafes: 'cafes', hotel: 'hotels', hotels: 'hotels',
    beach: 'beaches', beaches: 'beaches', vet: 'vets', vets: 'vets',
    groomer: 'groomers', groomers: 'groomers', shop: 'shops', shops: 'shops',
    'pet shop': 'shops', 'pet shops': 'shops',
    activity: 'activities', activities: 'activities', activitie: 'activities',
    pub: 'restaurants', pubs: 'restaurants', bar: 'restaurants',
    walker: 'walkers', walkers: 'walkers', 'dog walker': 'walkers', 'dog walking': 'walkers',
    trainer: 'trainers', trainers: 'trainers', 'dog trainer': 'trainers', 'dog training': 'trainers',
    daycare: 'daycare', boarding: 'daycare', kennel: 'daycare', kennels: 'daycare',
  };
  const lower = cat.toLowerCase().trim();
  if (exactMapping[lower]) return exactMapping[lower];

  // Fuzzy match for compound categories (e.g. "dog park", "Dog Beach/Park", "Cafe/Brunch", "Pub/Restaurant")
  // Order matters: check more specific terms first
  if (lower.includes('beach')) return 'beaches';
  if (lower.includes('park')) return 'parks';
  if (lower.includes('restaurant') || lower.includes('pub') || lower.includes('brunch')) return 'restaurants';
  if (lower.includes('cafe') || lower.includes('cafÃ©') || lower.includes('coffee')) return 'cafes';
  if (lower.includes('hotel') || lower.includes('hostel') || lower.includes('lodge') || lower.includes('bnb')) return 'hotels';
  if (lower.includes('vet') || lower.includes('clinic')) return 'vets';
  if (lower.includes('groom')) return 'groomers';
  if (lower.includes('shop') || lower.includes('store') || lower.includes('boutique')) return 'shops';
  if (lower.includes('walk') || lower.includes('pet sit')) return 'walkers';
  if (lower.includes('train') || lower.includes('obedience')) return 'trainers';
  if (lower.includes('daycare') || lower.includes('boarding') || lower.includes('kennel') || lower.includes('pension')) return 'daycare';

  return 'activities';
}

interface RawPlace {
  name: string; nameFr?: string; category: string; address: string;
  neighborhood?: string; phone?: string; website?: string;
  description: string; descriptionFr?: string;
  dogFeatures: Partial<DogFeatures>; priceLevel?: number;
  confidence?: number; reasoning?: string;
  latitude?: number; longitude?: number; rating?: number; reviewCount?: number;
  // Google Places enrichment fields
  googlePlaceId?: string;
  photoRefs?: string[];
  googleMapsUrl?: string;
  openingHours?: string[];
  enriched?: boolean;
}
async function loadCityJson(citySlug: string): Promise<RawPlace[]> {
  const fileName = CITY_DATA_MAP[citySlug];
  if (!fileName) return [];
  const paths = [
    path.join(process.cwd(), 'research-output', `${fileName}.json`),
    path.join(process.cwd(), `${fileName}.json`),
  ];
  for (const filePath of paths) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.places || [];
    } catch { continue; }
  }
  return [];
}

function rawToEstablishment(raw: RawPlace, citySlug: string, cityConfig: CityConfig, index: number): Establishment {
  const slug = slugify(raw.name);
  const category = normalizeCategory(raw.category);
  const coords = raw.latitude && raw.longitude
    ? { lat: raw.latitude, lng: raw.longitude }
    : generateCoordinates(cityConfig, raw.name, raw.category, index);
  // Handle dogFeatures as either array of strings (from research JSON) or object of booleans (from DB)
  const rawFeatures = raw.dogFeatures;
  const featureArray = Array.isArray(rawFeatures) ? rawFeatures : [];
  const featureObj = rawFeatures && !Array.isArray(rawFeatures) ? rawFeatures : {};
  const dogFeatures: DogFeatures = {
    waterBowl: featureObj.waterBowl || featureArray.includes('waterBowl') || false,
    treats: featureObj.treats || featureArray.includes('treats') || false,
    outdoorSeating: featureObj.outdoorSeating || featureArray.includes('outdoorSeating') || false,
    indoorAllowed: featureObj.indoorAllowed || featureArray.includes('indoorAllowed') || false,
    offLeashArea: featureObj.offLeashArea || featureArray.includes('offLeashArea') || false,
    dogMenu: featureObj.dogMenu || featureArray.includes('dogMenu') || false,
    fenced: featureObj.fenced || featureArray.includes('fenced') || false,
    shadeAvailable: featureObj.shadeAvailable || featureArray.includes('shadeAvailable') || false,
  };
  const confidence = raw.confidence || 80;
  const baseRating = raw.rating || (3.5 + (confidence / 100) * 1.5);
  const rating = Math.round(baseRating * 10) / 10;
  return {
    id: `${citySlug}-${slug}-${index}`,
    slug, citySlug, categorySlug: category,
    name: raw.name, nameFr: raw.nameFr,
    description: raw.description, descriptionFr: raw.descriptionFr,
    address: raw.address, latitude: coords.lat, longitude: coords.lng,
    phone: raw.phone, website: raw.website,
    priceLevel: (raw.priceLevel || 2) as 1 | 2 | 3 | 4,
    rating, reviewCount: raw.reviewCount || Math.floor(seededRandom(raw.name, 3) * 80 + 5),
    images: raw.photoRefs && raw.photoRefs.length > 0
      ? [
          ...raw.photoRefs.map(ref => `/api/places/photo?name=${encodeURIComponent(ref)}&maxWidth=800`),
          getDefaultImage(category, raw.name), // Category fallback always last
        ]
      : [getDefaultImage(category, raw.name)],
    hours: {}, dogFeatures, amenities: [],
    neighborhood: raw.neighborhood,
    tier: 'free' as const,
    isVerified: confidence > 90,
    isFeatured: confidence > 95 && seededRandom(raw.name, 5) > 0.7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
const dataCache = new Map<string, Establishment[]>();

export async function getCityEstablishments(citySlug: string): Promise<Establishment[]> {
  if (dataCache.has(citySlug)) return dataCache.get(citySlug)!;
  const cityConfig = CITIES[citySlug];
  if (!cityConfig) return [];
  const rawPlaces = await loadCityJson(citySlug);
  const establishments = rawPlaces.map((raw, index) => rawToEstablishment(raw, citySlug, cityConfig, index));
  dataCache.set(citySlug, establishments);
  return establishments;
}

export async function getCityEstablishmentsByCategory(citySlug: string, category: CategorySlug): Promise<Establishment[]> {
  const all = await getCityEstablishments(citySlug);
  return all.filter(e => e.categorySlug === category);
}

export async function getEstablishment(citySlug: string, establishmentSlug: string): Promise<Establishment | null> {
  const all = await getCityEstablishments(citySlug);
  const place = all.find(e => e.slug === establishmentSlug) || null;
  if (!place) return null;

  // Try to get the real database UUID for this establishment
  // This is needed so favorites, reviews, and check-ins use the correct ID
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Look up existing DB record by slug
    const { data: dbEst } = await supabaseAdmin
      .from('establishments')
      .select('id')
      .eq('slug', establishmentSlug)
      .single();

    if (dbEst && dbEst.id) {
      return { ...place, id: dbEst.id as string };
    }

    // If not in DB, auto-create so user actions (favorites, reviews, check-ins) work
    // First, get or resolve the city_id and category_id
    const { data: cityRecord } = await supabaseAdmin
      .from('cities')
      .select('id')
      .eq('slug', citySlug)
      .single();

    const categoryMap: Record<string, string> = {
      parks: 'parks', restaurants: 'restaurants', cafes: 'cafes',
      hotels: 'hotels', beaches: 'beaches', vets: 'vets',
      stores: 'stores', grooming: 'grooming', daycare: 'daycare',
      activities: 'activities',
    };
    const catSlug = categoryMap[place.categorySlug] || place.categorySlug;
    const { data: catRecord } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('slug', catSlug)
      .single();

    const { data: newEst } = await supabaseAdmin
      .from('establishments')
      .insert({
        name: place.name,
        slug: establishmentSlug,
        address: place.address,
        city_id: cityRecord?.id || null,
        category_id: catRecord?.id || null,
        description: place.description,
        status: 'ACTIVE',
        tier: 'free',
        is_verified: false,
        is_featured: false,
        rating: place.rating || 0,
        review_count: place.reviewCount || 0,
        price_level: place.priceLevel || 2,
        phone: place.phone || null,
        website: place.website || null,
        latitude: place.latitude || null,
        longitude: place.longitude || null,
      })
      .select('id')
      .single();

    if (newEst && newEst.id) {
      return { ...place, id: newEst.id as string };
    }
  } catch (err) {
    // If Supabase lookup/creation fails, continue with static ID
    console.error('Failed to resolve establishment UUID:', err);
  }

  return place;
}

export async function searchEstablishments(citySlug: string, query: string): Promise<Establishment[]> {
  const all = await getCityEstablishments(citySlug);
  const lower = query.toLowerCase();
  return all.filter(e =>
    e.name.toLowerCase().includes(lower) ||
    e.description.toLowerCase().includes(lower) ||
    (e.neighborhood && e.neighborhood.toLowerCase().includes(lower))
  );
}

export async function getCityCategoryCounts(citySlug: string): Promise<Record<string, number>> {
  const all = await getCityEstablishments(citySlug);
  const counts: Record<string, number> = {};
  for (const e of all) { counts[e.categorySlug] = (counts[e.categorySlug] || 0) + 1; }
  return counts;
}
/**
 * Fetches approved user-uploaded photos from Supabase and merges them into
 * establishments. User photos are placed FIRST in the images array, followed
 * by Google Places refs, with Unsplash category fallback always last.
 *
 * Image priority: User uploads (approved) > Google Places photos > Category Unsplash fallback
 */
export async function enrichEstablishmentsWithUserPhotos(
  establishments: Establishment[]
): Promise<Establishment[]> {
  try {
    const supabase = await createClient();

    // Get all approved photos with their establishment slugs
    const { data: dbEstablishments, error: estError } = await supabase
      .from('establishments')
      .select('id, slug, city_id, images, primary_image')
      .in('status', ['ACTIVE']);

    if (estError || !dbEstablishments || dbEstablishments.length === 0) {
      return establishments; // No DB establishments, return as-is
    }

    // Get approved photos for these establishments
    const estIds = dbEstablishments.map((e: Record<string, unknown>) => e.id as string);
    const { data: approvedPhotos, error: photoError } = await supabase
      .from('photos')
      .select('url, establishment_id')
      .in('establishment_id', estIds)
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });

    if (photoError || !approvedPhotos || approvedPhotos.length === 0) {
      return establishments; // No approved photos, return as-is
    }

    // Build a map: establishment slug -> approved photo URLs
    const photosByEstId = new Map<string, string[]>();
    for (const photo of approvedPhotos) {
      const estId = photo.establishment_id as string;
      if (!photosByEstId.has(estId)) {
        photosByEstId.set(estId, []);
      }
      photosByEstId.get(estId)!.push(photo.url as string);
    }

    // Build slug -> photos map using the DB establishment slugs
    const photosBySlug = new Map<string, string[]>();
    for (const dbEst of dbEstablishments) {
      const slug = dbEst.slug as string;
      const estId = dbEst.id as string;
      const photos = photosByEstId.get(estId);
      if (photos && photos.length > 0) {
        photosBySlug.set(slug, photos);
      }
    }

    if (photosBySlug.size === 0) {
      return establishments; // No matching photos
    }

    // Merge user photos into establishments
    return establishments.map(est => {
      const userPhotos = photosBySlug.get(est.slug);
      if (!userPhotos || userPhotos.length === 0) {
        return est; // No user photos for this establishment
      }

      // Build the merged images array:
      // 1. User-uploaded approved photos (highest priority)
      // 2. Google Places photo refs (existing non-Unsplash, non-user images)
      // 3. Category Unsplash fallback (always last)
      const existingImages = est.images;
      const unsplashFallback = existingImages.filter(img => img.includes('unsplash.com'));
      const googlePhotos = existingImages.filter(
        img => !img.includes('unsplash.com') && !userPhotos.includes(img)
      );

      const mergedImages = [
        ...userPhotos,
        ...googlePhotos,
        ...unsplashFallback,
      ];

      return {
        ...est,
        images: mergedImages,
      };
    });
  } catch (error) {
    // If Supabase is unavailable, silently fall back to existing data
    console.error('Failed to enrich establishments with user photos:', error);
    return establishments;
  }
}

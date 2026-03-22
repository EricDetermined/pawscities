import { notFound } from 'next/navigation';
import { getCityConfig, CATEGORIES } from '@/lib/cities-config';
import { getCityEstablishments, enrichEstablishmentsWithUserPhotos } from '@/lib/data';
import { CityPageClient } from './CityPageClient';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import type { Establishment, CategorySlug, DogFeatures } from '@/types';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface CityPageProps {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const city = getCityConfig(params.slug);
  if (!city) return {};
  return {
    title: `Dog-Friendly Places in ${city.name} | Paw Cities`,
    description: city.description,
  };
}

function dbToEstablishment(dbEst: Record<string, unknown>, citySlug: string, cityLat: number, cityLng: number): Establishment | null {
  const catSlug = (dbEst.categories as { slug: string } | null)?.slug || 'restaurants';
  const df = (dbEst.dog_features || {}) as Record<string, boolean>;
  const dogFeatures: DogFeatures = {
    waterBowl: df.waterBowl || false,
    treats: df.treats || false,
    outdoorSeating: df.outdoorSeating || false,
    indoorAllowed: df.indoorAllowed || false,
    offLeashArea: df.offLeashArea || false,
    dogMenu: df.dogMenu || false,
    fenced: df.fenced || false,
    shadeAvailable: df.shadeAvailable || false,
  };

  // Build images from photo_refs or primary_image
  let images: string[] = [];
  const photoRefs = dbEst.photo_refs as string[] | null;
  if (photoRefs && Array.isArray(photoRefs) && photoRefs.length > 0) {
    images = photoRefs.map((ref: string) =>
      ref.startsWith('places/')
        ? `/api/places/photo?name=${encodeURIComponent(ref)}&maxWidth=800`
        : ref
    );
  } else if (dbEst.primary_image) {
    images = [dbEst.primary_image as string];
  }

  // For research-imported establishments, use a category fallback image if no Google photo
  if (images.length === 0 && dbEst.source !== 'business_claim') {
    // These are research-imported — they should have had photos from import
    // Use a generic image as last resort so they still show
    const fallbacks: Record<string, string> = {
      parks: 'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800&h=600&fit=crop',
      restaurants: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
      cafes: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop',
      hotels: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop',
      beaches: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
      vets: 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=800&h=600&fit=crop',
    };
    images = [fallbacks[catSlug] || fallbacks.restaurants];
  }

  // For user-submitted businesses: require at least one real image
  if (images.length === 0 && dbEst.source === 'business_claim') {
    return null; // Skip — no photo yet
  }

  return {
    id: dbEst.id as string,
    slug: dbEst.slug as string,
    citySlug,
    categorySlug: catSlug as CategorySlug,
    name: dbEst.name as string,
    description: (dbEst.description as string) || `Dog-friendly in ${citySlug}`,
    address: (dbEst.address as string) || '',
    latitude: (dbEst.latitude as number) || cityLat,
    longitude: (dbEst.longitude as number) || cityLng,
    phone: (dbEst.phone as string) || undefined,
    website: (dbEst.website as string) || undefined,
    priceLevel: ((dbEst.price_level as number) || 2) as 1 | 2 | 3 | 4,
    rating: (dbEst.rating as number) || 0,
    reviewCount: (dbEst.review_count as number) || 0,
    images,
    hours: {},
    dogFeatures,
    amenities: [],
    neighborhood: undefined,
    tier: (dbEst.tier as string) || 'free',
    isVerified: (dbEst.is_verified as boolean) || false,
    isFeatured: (dbEst.is_featured as boolean) || false,
    createdAt: (dbEst.created_at as string) || new Date().toISOString(),
    updatedAt: (dbEst.updated_at as string) || new Date().toISOString(),
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const city = getCityConfig(params.slug);
  if (!city) notFound();

  let establishments: Establishment[] = [];
  let usedDb = false;

  // Primary source: Supabase database
  try {
    const supabase = getSupabaseAdmin();
    const { data: cityRecord } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (cityRecord) {
      const { data: dbEstablishments } = await supabase
        .from('establishments')
        .select('*, categories:category_id(slug)')
        .eq('city_id', cityRecord.id)
        .eq('status', 'ACTIVE')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .order('name');

      if (dbEstablishments && dbEstablishments.length > 0) {
        for (const dbEst of dbEstablishments) {
          const est = dbToEstablishment(dbEst, params.slug, city.latitude, city.longitude);
          if (est) establishments.push(est);
        }
        usedDb = true;
      }
    }
  } catch (err) {
    console.error('Failed to fetch establishments from DB:', err);
  }

  // Fallback: if DB returned no results, use research JSON files
  if (!usedDb || establishments.length === 0) {
    const baseEstablishments = await getCityEstablishments(params.slug);
    establishments = await enrichEstablishmentsWithUserPhotos(baseEstablishments);
  }

  // Calculate category counts
  const categoryCounts: Record<string, number> = {};
  establishments.forEach(e => {
    categoryCounts[e.categorySlug] = (categoryCounts[e.categorySlug] || 0) + 1;
  });

  return (
    <CityPageClient
      city={city}
      establishments={establishments}
      categoryCounts={categoryCounts}
      categories={CATEGORIES}
    />
  );
}

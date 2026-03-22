import { notFound } from 'next/navigation';
import { getCityConfig, CATEGORIES } from '@/lib/cities-config';
import { getCityEstablishments, getCityCategoryCounts, enrichEstablishmentsWithUserPhotos } from '@/lib/data';
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

export default async function CityPage({ params }: CityPageProps) {
  const city = getCityConfig(params.slug);
  if (!city) notFound();

  const baseEstablishments = await getCityEstablishments(params.slug);
  const establishments = await enrichEstablishmentsWithUserPhotos(baseEstablishments);

  // Also fetch user-submitted establishments from Supabase that aren't in the research data
  try {
    const supabase = getSupabaseAdmin();
    const { data: cityRecord } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (cityRecord) {
      const existingSlugs = new Set(establishments.map(e => e.slug));

      const { data: dbEstablishments } = await supabase
        .from('establishments')
        .select('*, categories:category_id(slug)')
        .eq('city_id', cityRecord.id)
        .eq('status', 'ACTIVE')
        .order('name');

      if (dbEstablishments) {
        for (const dbEst of dbEstablishments) {
          if (existingSlugs.has(dbEst.slug)) continue;

          const catSlug = (dbEst.categories as { slug: string } | null)?.slug || 'restaurants';
          const df = dbEst.dog_features || {};
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

          // Build images — only show listing if it has at least one real image
          let images: string[] = [];
          if (dbEst.photo_refs && Array.isArray(dbEst.photo_refs) && dbEst.photo_refs.length > 0) {
            images = dbEst.photo_refs.map((ref: string) =>
              ref.startsWith('places/')
                ? `/api/places/photo?name=${encodeURIComponent(ref)}&maxWidth=800`
                : ref
            );
          } else if (dbEst.primary_image) {
            images = [dbEst.primary_image];
          }

          // Also check for approved user-uploaded photos
          if (images.length === 0) {
            const { data: approvedPhotos } = await supabase
              .from('photos')
              .select('url')
              .eq('establishment_id', dbEst.id)
              .eq('status', 'APPROVED')
              .limit(1);
            if (approvedPhotos && approvedPhotos.length > 0) {
              images = approvedPhotos.map((p: { url: string }) => p.url);
            }
          }

          // Skip this establishment if no images — don't show listings without photos
          if (images.length === 0) continue;

          const establishment: Establishment = {
            id: dbEst.id,
            slug: dbEst.slug,
            citySlug: params.slug,
            categorySlug: catSlug as CategorySlug,
            name: dbEst.name,
            description: dbEst.description || `${dbEst.name} - Dog-friendly in ${city.name}`,
            address: dbEst.address || '',
            latitude: dbEst.latitude || city.latitude,
            longitude: dbEst.longitude || city.longitude,
            phone: dbEst.phone || undefined,
            website: dbEst.website || undefined,
            priceLevel: (dbEst.price_level || 2) as 1 | 2 | 3 | 4,
            rating: dbEst.rating || 0,
            reviewCount: dbEst.review_count || 0,
            images,
            hours: {},
            dogFeatures,
            amenities: [],
            neighborhood: undefined,
            tier: dbEst.tier || 'free',
            isVerified: dbEst.is_verified || false,
            isFeatured: dbEst.is_featured || false,
            createdAt: dbEst.created_at || new Date().toISOString(),
            updatedAt: dbEst.updated_at || new Date().toISOString(),
          };

          establishments.push(establishment);
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch DB establishments:', err);
  }

  const categoryCounts = await getCityCategoryCounts(params.slug);

  return (
    <CityPageClient
      city={city}
      establishments={establishments}
      categoryCounts={categoryCounts}
      categories={CATEGORIES}
    />
  );
}

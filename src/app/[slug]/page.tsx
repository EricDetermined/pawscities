import { notFound } from 'next/navigation';
import { getCityConfig, CATEGORIES } from '@/lib/cities-config';
import { getCityEstablishments, enrichEstablishmentsWithUserPhotos } from '@/lib/data';
import { getCityEvents } from '@/lib/events';
import { CityPageClient } from './CityPageClient';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import type { Establishment, CategorySlug, DogFeatures, ListingType } from '@/types';

const BASE_URL = 'https://pawcities.com';

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
  const url = `${BASE_URL}/${city.slug}`;
  return {
    title: `Dog-Friendly Places in ${city.name} | Paw Cities`,
    description: city.description,
    alternates: { canonical: url },
    openGraph: {
      title: `Dog-Friendly Places in ${city.name}`,
      description: city.description,
      url,
      siteName: 'Paw Cities',
      type: 'website',
      images: [{ url: `${BASE_URL}/images/og-default.png`, width: 1200, height: 630, alt: `Dog-Friendly ${city.name} - Paw Cities` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Dog-Friendly Places in ${city.name}`,
      description: city.description,
      images: [`${BASE_URL}/images/og-default.png`],
    },
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
      groomers: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&h=600&fit=crop',
      activities: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=600&fit=crop',
      bakeries: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&h=600&fit=crop',
      shops: 'https://images.unsplash.com/photo-1583337130417-13104dec14a8?w=800&h=600&fit=crop',
      daycare: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=600&fit=crop',
      trainers: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop',
      walkers: 'https://images.unsplash.com/photo-1522276498395-f4f68f7f8571?w=800&h=600&fit=crop',
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
    listingType: (dbEst.listing_type as ListingType) || 'storefront',
    serviceArea: (dbEst.service_area as string) || undefined,
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
    tier: ((dbEst.tier as string) || 'free') as 'free' | 'claimed' | 'premium',
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
        .select('*, categories:category_id(slug), listing_type, service_area')
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

  // Fetch upcoming events for this city
  let cityEvents: Awaited<ReturnType<typeof getCityEvents>> = { events: [], total: 0 };
  try {
    cityEvents = await getCityEvents(params.slug, { limit: 20 });
  } catch (e) {
    console.error(`Failed to fetch events for ${params.slug}:`, e);
  }

  // JSON-LD: BreadcrumbList + ItemList for the city
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Paw Cities', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: city.name, item: `${BASE_URL}/${city.slug}` },
    ],
  };

  // JSON-LD: Event schema for upcoming city events
  const eventListLd = cityEvents.events.slice(0, 10).map((event) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    ...(event.description ? { description: event.description } : {}),
    startDate: event.startDate,
    ...(event.endDate ? { endDate: event.endDate } : {}),
    ...(event.venueName ? {
      location: {
        '@type': 'Place',
        name: event.venueName,
        ...(event.venueAddress ? { address: event.venueAddress } : {}),
        ...(event.latitude && event.longitude ? {
          geo: { '@type': 'GeoCoordinates', latitude: event.latitude, longitude: event.longitude },
        } : {}),
      },
    } : {
      location: { '@type': 'Place', name: city.name },
    }),
    ...(event.isFree ? { isAccessibleForFree: true } : {}),
    ...(event.imageUrl ? { image: event.imageUrl } : {}),
    organizer: { '@type': 'Organization', name: 'Paw Cities', url: BASE_URL },
  }));

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Dog-Friendly Places in ${city.name}`,
    description: city.description,
    numberOfItems: establishments.length,
    itemListElement: establishments.slice(0, 20).map((est, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: est.name,
      url: `${BASE_URL}/${city.slug}/${est.slug}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      {eventListLd.length > 0 && eventListLd.map((eventLd, i) => (
        <script key={`event-ld-${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }} />
      ))}
      <CityPageClient
        city={city}
        establishments={establishments}
        categoryCounts={categoryCounts}
        categories={CATEGORIES}
        events={cityEvents.events}
      />
    </>
  );
}

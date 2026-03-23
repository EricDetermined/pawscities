import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCityConfig, CATEGORIES } from '@/lib/cities-config';
import { getEstablishment, getCityEstablishments } from '@/lib/data';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import type { Establishment, CategorySlug, DogFeatures } from '@/types';
import { ListingBadges } from '@/components/ListingBadges';
import EstablishmentInteractions from '@/components/EstablishmentInteractions';
import { TrackedContactButtons } from '@/components/TrackedContactButtons';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface Props {
  params: { slug: string; establishment: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = getCityConfig(params.slug);
  let place = await getEstablishment(params.slug, params.establishment);
  if (!place) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: dbEst } = await supabase
        .from('establishments')
        .select('name, description')
        .eq('slug', params.establishment)
        .eq('status', 'ACTIVE')
        .single();
      if (dbEst) place = { name: dbEst.name, description: dbEst.description } as Establishment;
    } catch { /* fallthrough */ }
  }
  if (!city || !place) return {};
  return {
    title: `${place.name} - Dog-Friendly in ${city.name} | Paw Cities`,
    description: place.description,
  };
}

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];


export default async function EstablishmentPage({ params }: Props) {
  const city = getCityConfig(params.slug);
  if (!city) notFound();

  let place = await getEstablishment(params.slug, params.establishment);

  // If not in research JSON, check the database (user-submitted businesses)
  if (!place) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: dbEst } = await supabase
        .from('establishments')
        .select('*, categories:category_id(slug)')
        .eq('slug', params.establishment)
        .eq('status', 'ACTIVE')
        .single();

      if (dbEst) {
        const catSlug = (dbEst.categories as { slug: string } | null)?.slug || 'restaurants';
        const df = (dbEst.dog_features || {}) as Record<string, boolean>;
        const dogFeatures: DogFeatures = {
          waterBowl: df.waterBowl || false, treats: df.treats || false,
          outdoorSeating: df.outdoorSeating || false, indoorAllowed: df.indoorAllowed || false,
          offLeashArea: df.offLeashArea || false, dogMenu: df.dogMenu || false,
          fenced: df.fenced || false, shadeAvailable: df.shadeAvailable || false,
        };
        let images: string[] = [];
        if (dbEst.photo_refs && Array.isArray(dbEst.photo_refs) && dbEst.photo_refs.length > 0) {
          images = dbEst.photo_refs.map((ref: string) =>
            ref.startsWith('places/') ? `/api/places/photo?name=${encodeURIComponent(ref)}&maxWidth=800` : ref
          );
        } else if (dbEst.primary_image) {
          images = [dbEst.primary_image];
        }
        if (images.length === 0) {
          images = ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop'];
        }

        place = {
          id: dbEst.id, slug: dbEst.slug, citySlug: params.slug,
          categorySlug: catSlug as CategorySlug,
          name: dbEst.name, description: dbEst.description || '',
          address: dbEst.address || '', latitude: dbEst.latitude || city.latitude,
          longitude: dbEst.longitude || city.longitude,
          phone: dbEst.phone || undefined, website: dbEst.website || undefined,
          priceLevel: (dbEst.price_level || 2) as 1 | 2 | 3 | 4,
          rating: dbEst.rating || 0, reviewCount: dbEst.review_count || 0,
          images, hours: {}, dogFeatures, amenities: [],
          neighborhood: undefined, tier: dbEst.tier || 'free',
          isVerified: dbEst.is_verified || false, isFeatured: dbEst.is_featured || false,
          createdAt: dbEst.created_at || new Date().toISOString(),
          updatedAt: dbEst.updated_at || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('DB establishment lookup failed:', err);
    }
  }

  if (!place) notFound();

  const allPlaces = await getCityEstablishments(params.slug);
  const similar = allPlaces
    .filter(e => e.categorySlug === place!.categorySlug && e.id !== place!.id)
    .slice(0, 3);

  const category = CATEGORIES.find(c => c.slug === place.categorySlug);

  const featureList = [
    { key: 'waterBowl', label: 'Water Bowls', icon: '/features/water.svg', emoji: '💧', active: place.dogFeatures.waterBowl },
    { key: 'treats', label: 'Dog Treats', icon: '/features/treat.svg', emoji: '🦴', active: place.dogFeatures.treats },
    { key: 'outdoorSeating', label: 'Outdoor Seating', icon: '/features/outdoor.svg', emoji: '☀️', active: place.dogFeatures.outdoorSeating },
    { key: 'indoorAllowed', label: 'Dogs Inside', icon: '/features/indoor.svg', emoji: '🏠', active: place.dogFeatures.indoorAllowed },
    { key: 'offLeashArea', label: 'Off-Leash', icon: '/features/leash.svg', emoji: '🐕', active: place.dogFeatures.offLeashArea },
    { key: 'dogMenu', label: 'Dog Menu', icon: '/features/menu.svg', emoji: '🍖', active: place.dogFeatures.dogMenu },
    { key: 'fenced', label: 'Fenced', icon: '/features/fence.svg', emoji: '🔒', active: place.dogFeatures.fenced },
    { key: 'shadeAvailable', label: 'Shade', icon: '/features/shade.svg', emoji: '🌳', active: place.dogFeatures.shadeAvailable },
  ];

  const hasHours = place.hours && Object.keys(place.hours).length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <nav className="container mx-auto px-4 py-3">
        <Link href={`/${city.slug}`} className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {city.name}
        </Link>
      </nav>

      {/* Hero Image */}
      <div className="relative h-72 md:h-[420px] overflow-hidden bg-gray-200">
        <img
          src={place.images[0]}
          alt={place.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="container mx-auto">
            <ListingBadges tier={place.tier || 'FREE'} isClaimed={place.isVerified || false} />
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-2">{place.name}</h1>
            <p className="text-white/80 text-lg">{place.address}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Rating & Price & Quick Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-lg flex items-center gap-1">
                    <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {place.rating.toFixed(1)}
                  </div>
                  <span className="text-gray-500 text-sm">{place.reviewCount} Google reviews</span>
                </div>
                <div className="flex items-center gap-0.5 text-gray-600 font-medium">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className={i < place.priceLevel ? 'text-gray-800' : 'text-gray-300'}>$</span>
                  ))}
                </div>
                {place.neighborhood && (
                  <span className="text-gray-500 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {place.neighborhood}
                  </span>
                )}
              </div>
              <p className="text-gray-700 leading-relaxed text-lg">{place.description}</p>

              {/* Amenities */}
              {place.amenities && place.amenities.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {place.amenities.map((amenity) => (
                    <span key={amenity} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                      {amenity}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Dog-Friendly Features — only show confirmed features */}
            {featureList.some(f => f.active) && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                <span>🐾</span> Dog-Friendly Features
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {featureList.filter(f => f.active).map(feature => (
                  <div
                    key={feature.key}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-green-50 border-green-200 text-green-700"
                  >
                    <span className="text-lg">{feature.emoji}</span>
                    <span className="text-sm font-medium">{feature.label}</span>
                    <svg className="w-4 h-4 ml-auto text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ))}
              </div>
              {place.dogFeatures.sizeRestrictions && place.dogFeatures.sizeRestrictions !== 'all' && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  Size restriction: {place.dogFeatures.sizeRestrictions} dogs only
                </div>
              )}
              {place.dogFeatures.notes && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  {place.dogFeatures.notes}
                </div>
              )}
            </div>
            )}

            {/* Business Hours */}
            {hasHours && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Business Hours
                </h2>
                <div className="space-y-2">
                  {DAY_NAMES.map((day, i) => {
                    const hours = (place.hours as Record<string, { open: string; close: string }>)[day];
                    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    const isToday = day === today;
                    return (
                      <div key={day} className={`flex justify-between items-center py-1.5 px-3 rounded-lg text-sm ${isToday ? 'bg-primary-50 font-medium' : ''}`}>
                        <span className={isToday ? 'text-primary-700' : 'text-gray-600'}>{DAY_LABELS[i]}</span>
                        <span className={isToday ? 'text-primary-700' : 'text-gray-800'}>
                          {hours ? `${hours.open} - ${hours.close}` : 'Closed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Interactive Reviews, Favorites, Check-in, Share */}
            <EstablishmentInteractions
              establishmentId={place.id}
              establishmentName={place.name}
              establishmentSlug={place.slug}
              citySlug={city.slug}
              initialRating={place.rating}
              initialReviewCount={place.reviewCount}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Contact Info</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-700">{place.address}</span>
                </div>
                {place.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${place.phone}`} className="text-primary-600 hover:underline">{place.phone}</a>
                  </div>
                )}
                {place.website && (
                  <div className="flex items-center gap-3 text-sm">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">
                      {place.website.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  </div>
                )}
              </div>
              <TrackedContactButtons
                establishmentId={place.id}
                phone={place.phone}
                website={place.website}
                latitude={place.latitude}
                longitude={place.longitude}
              />
            </div>

            {/* City Dog Info — only show leash/off-leash rules, not transit */}
            {city.dogRegulations.leashRequired && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <span>🐕</span> {city.name} Dog Rules
                </h3>
                <p className="text-sm text-amber-700 leading-relaxed flex items-center gap-1">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Leash required in public areas
                </p>
                {city.dogRegulations.offLeashAreas && (
                  <p className="text-sm text-green-700 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Designated off-leash areas available in {city.name}
                  </p>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Similar Places */}
        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-bold mb-6">More {category?.name} in {city.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similar.map(s => (
                  <Link
                    key={s.id}
                    href={`/${city.slug}/${s.slug}`}
                    className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="relative h-44 overflow-hidden bg-gray-200">
                      <img src={s.images[0]} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute top-3 left-3">
                        <span className="bg-white/90 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded-full">
                          {category?.icon} {category?.name}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{s.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span>{s.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-gray-300">|</span>
                        <span>{Array.from({ length: s.priceLevel }).map(() => '$').join('')}</span>
                        {s.neighborhood && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{s.neighborhood}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{s.description}</p>
                    </div>
                  </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4 mt-8">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-display text-xl font-bold text-white">Paw Cities</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-500">© 2026 Paw Cities. Made with love for dogs and their humans.</p>
        </div>
      </footer>
    </div>
  );
}

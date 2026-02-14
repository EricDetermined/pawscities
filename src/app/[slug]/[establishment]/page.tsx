import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCityConfig, CATEGORIES } from '@/lib/cities-config';
import { getEstablishment, getCityEstablishments } from '@/lib/data';
import type { Metadata } from 'next';
import { ListingBadges } from '@/components/ListingBadges';

interface Props {
  params: { slug: string; establishment: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = getCityConfig(params.slug);
  const place = await getEstablishment(params.slug, params.establishment);
  if (!city || !place) return {};
  return {
    title: `${place.name} - Dog-Friendly in ${city.name} | Paw Cities`,
    description: place.description,
  };
}

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function generateSampleReviews(placeName: string, rating: number) {
  const reviews = [
    {
      name: 'Sarah M.',
      avatar: 'SM',
      rating: Math.min(5, Math.round(rating + 0.3)),
      date: '2 weeks ago',
      dogName: 'Luna',
      text: `Absolutely loved bringing Luna here! The staff was incredibly welcoming and brought out a water bowl right away. ${placeName} is now our go-to spot.`,
    },
    {
      name: 'Marc D.',
      avatar: 'MD',
      rating: Math.round(rating),
      date: '1 month ago',
      dogName: 'Rex',
      text: `Great experience with Rex. The outdoor area is spacious and other dog owners were friendly. Will definitely come back!`,
    },
    {
      name: 'Emma L.',
      avatar: 'EL',
      rating: Math.min(5, Math.round(rating - 0.2)),
      date: '2 months ago',
      dogName: 'Bella',
      text: `Nice place but can get crowded on weekends. Bella enjoyed the treats they offered. Good atmosphere overall and dog-friendly vibes.`,
    },
  ];
  return reviews;
}

export default async function EstablishmentPage({ params }: Props) {
  const city = getCityConfig(params.slug);
  if (!city) notFound();

  const place = await getEstablishment(params.slug, params.establishment);
  if (!place) notFound();

  const allPlaces = await getCityEstablishments(params.slug);
  const similar = allPlaces
    .filter(e => e.categorySlug === place.categorySlug && e.id !== place.id)
    .slice(0, 3);

  const category = CATEGORIES.find(c => c.slug === place.categorySlug);
  const reviews = generateSampleReviews(place.name, place.rating);

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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-primary-600">Paw Cities</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href={`/${city.slug}`} className="flex items-center gap-1 text-gray-600 hover:text-primary-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to {city.name}
              </Link>
            </nav>
          </div>
        </div>
      </header>

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

            {/* Dog-Friendly Features */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                <span>🐾</span> Dog-Friendly Features
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {featureList.map(feature => (
                  <div
                    key={feature.key}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      feature.active
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-100 text-gray-400'
                    }`}
                  >
                    <span className="text-lg">{feature.emoji}</span>
                    <span className="text-sm font-medium">{feature.label}</span>
                    {feature.active && (
                      <svg className="w-4 h-4 ml-auto text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
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

            {/* Reviews */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Reviews ({place.reviewCount})
                </h2>
                <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors">
                  Write a Review
                </button>
              </div>

              {/* Rating Summary */}
              <div className="flex items-center gap-6 mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">{place.rating.toFixed(1)}</div>
                  <div className="flex items-center gap-0.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className={`w-4 h-4 ${i < Math.round(place.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 fill-current'}`} viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{place.reviewCount} reviews</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const pct = stars === Math.round(place.rating)
                      ? 55
                      : stars === Math.round(place.rating) - 1
                        ? 25
                        : stars === Math.round(place.rating) + 1
                          ? 15
                          : 3;
                    return (
                      <div key={stars} className="flex items-center gap-2 text-sm">
                        <span className="w-3 text-gray-500">{stars}</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Review Cards */}
              <div className="space-y-4">
                {reviews.map((review, i) => (
                  <div key={i} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm shrink-0">
                        {review.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{review.name}</span>
                          <span className="text-gray-400 text-sm">{review.date}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <svg key={j} className={`w-4 h-4 ${j < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300 fill-current'}`} viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          {review.dogName && (
                            <span className="ml-2 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                              🐕 with {review.dogName}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{review.text}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                            Helpful
                          </button>
                          <button className="text-xs text-gray-400 hover:text-gray-600">Reply</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="mt-4 w-full py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                View all {place.reviewCount} reviews
              </button>
            </div>
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
              <div className="mt-5 flex flex-col gap-2">
                {place.phone && (
                  <a href={`tel:${place.phone}`} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call Now
                  </a>
                )}
                {place.website && (
                  <a href={place.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Visit Website
                  </a>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Get Directions
                </a>
              </div>
            </div>

            {/* Dog Regulations */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <span>🐕</span> Local Dog Rules
              </h3>
              <p className="text-sm text-amber-700 leading-relaxed">{city.dogRegulations.publicTransport}</p>
              {city.dogRegulations.leashRequired && (
                <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Leash required in public areas
                </p>
              )}
            </div>

            {/* Share */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-3">Share this place</h3>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                  Facebook
                </button>
                <button className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-colors">
                  Instagram
                </button>
                <button className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                  Copy Link
                </button>
              </div>
            </div>
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

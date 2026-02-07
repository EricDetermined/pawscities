import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCityConfig, CATEGORIES } from '@/lib/cities-config';
import { getEstablishment, getCityEstablishments } from '@/lib/data';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string; establishment: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = getCityConfig(params.slug);
  const place = await getEstablishment(params.slug, params.establishment);
  if (!city || !place) return {};
  return {
    title: `${place.name} - Dog-Friendly in ${city.name} | PawsCities`,
    description: place.description,
  };
}

export default async function EstablishedtPage({ params }: Props) {
  const city = getCityConfig(params.slug);
  if (!city) notFound();

  const place = await getEstablishent(params.slug, params.establishment);
  if (!place) notFound();

  const allPlaces = await getCityEstablishments(params.slug);
  const similar = allPlaces
    .filter(e => e.categorySlug === place.categorySlug && e.id !== place.id)
    .slice(0, 3);

  const category = CATEGORIES,dn$e(c => c.slug === place.categorySlug);

  const featureList = [
    { key: 'waterBowl', label: 'Water Bowls', icon: '💧', active: place.dogFeatures.waterBowl },
    { key: 'treats', label: 'Dog Treats', icon: '🦴', active: place.dogFeatures.treats },
    { key: 'outdoorSeating', label: 'Outdoor Seating', icon: '☀️', active: place.dogFeatures.outdoorSeating },
    { key: 'indoorAllowed', label: 'Dogs Allowed Inside', icon: '🏠', active: place.dogFeatures.indoorAllowed },
    { key: 'offLeashArea', label: 'Off-Leash Area', icon: '🐕', active: place.dogFeatures.offLeashArea },
    { key: 'dogMenu', label: 'Dog Menu', icon: '🍖', active: place.dogFeatures.dogMenu },
    { key: 'fenced', label: 'Fenced Area', icon: '🔒', active: place.dogFeatures.fenced },
    { key: 'shadeAvailable', label: 'Shade Available', icon: '🌳', active: place.dogFeatures.shadeAvailable },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-primary-600">PawsCities</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href={`/${city.slug}`} className="text-gray-600 hover:text-primary-600 transition-colors">
                ← Back to {city.name}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      <div className="relative h-64 md:h-96 overflow-hidden">
        <img src={place.images[0]} alt={place.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="container mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
                {category?.icon} {category?.name}
              </span>
              {place.isVerified && (
                <span className="bg-blue-500/80 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">✓ Verified</span>
              )}
              {place.isFeatured && (
                <span className="bg-amber-500/80 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">⭐ Featured</span>
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-1">{place.name}</h1>
            <p className="text-white/80">{place.address}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Rating & Price */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-lg">
                    ★ {place.rating.toFixed(1)}
                  </div>
                  <span className="text-gray-500 text-sm">{place.reviewCount} reviews</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  {'€'.repeat(place.priceLevel)}
                  <span className="text-gray-300">{'€'.repeat(4 - place.priceLevel)}</span>
                </div>
                {place.neighborhood && (
                  <span className="text-gray-500 text-sm">📍 {place.neighborhood}</span>
                )}
              </div>
              <p className="text-gray-700 leading-relaxed">{place.description}</p>
            </div>

            {/* Dog-Friendly Features */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold mb-4">🐾 Dog-Friendly Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {featureList.map(feature => (
                  <div
                    key={feature.key}
                    className={`flex items-center gap-2 p-3 rounded-lg border ${
                      feature.active
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <span className="text-lg">{feature.icon}</span>
                    <span className="text-sm font-medium">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews placeholder */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold mb-4">Reviews</h2>
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📝</div>
                <p>Reviews coming soon! Be the first to review {place.name}.</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Contact Info</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400">📍</span>
                  <span className="text-gray-700">{place.address}</span>
                </div>
                {place.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">📞</span>
                    <a href={`tel:${place.phone}`} className="text-primary-600 hover:underline">{place.phone}</a>
                  </div>
                )}
                {place.website && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">🌐</span>
                    <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{place.website.replace(/^https?:\/\//, '')}</a>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {place.phone && (
                  <a href={`tel:${place.phone}`} className="btn-primary text-center text-sm">📞 Call Now</a>
                )}
                {place.website && (
                  <a href={place.website} target="_blank" rel="noopener noreferrer" className="btn-secondary text-center text-sm">🌐 Visit Website</a>
                )}
                <a
                  href={`https://www.google.com/maps/dir??api=1&destination=${place.latitude},${place.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-ghost text-center text-sm border border-gray-200 rounded-xl"
                >
                  🗺️ Get Directions
                </a>
              </div>
            </div>

            {/* Dog Regulations */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-semibold text-amber-800 mb-2">🐕 Local Dog Rules</h3>
              <p className="text-sm text-amber-700">{city.dogRegulations.publicTransport}</p>
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
                  className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" hover:shadow-md transition-all"
                >
                  <div className="relative h-40 overflow-hidden">
                    <img src={s.images[0]} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold line-clamp-1">{s.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <span>★ {s.rating.toFixed(1)}</span>
                      <span>•</span>
                      <span>{'€'.repeat(s.priceLevK1"}</span>
                      {.neighborhood && <><span>•</span><span>{s.neighborhood}</span></>}
                    </div>
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
            <span className="font-display text-xl font-bold text-white">PawsCities</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 PawsCities. Made with ❤️ for dogs and their humans.</p>
        </div>
      </footer>
    </div>
  );
}

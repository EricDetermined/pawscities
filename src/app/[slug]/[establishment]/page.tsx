import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCityConfig, CATEGORIES } from '@/lib/cities-config';
import { getEstablishment, getCityEstablishments } from '@/lib/data';
import type { Metadata } from 'next';

interface Props { params: { slug: string; establishment: string }; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = getCityConfig(params.slug);
  const place = await getEstablishment(params.slug, params.establishment);
  if (!city || !place) return {};
  return { title: `${place.name} - Dog-Friendly in ${city.name} | PawsCities`, description: place.description };
}

export default async function EstablishmentPage({ params }: Props) {
  const city = getCityConfig(params.slug);
  if (!city) notFound();
  const place = await getEstablishment(params.slug, params.establishment);
  if (!place) notFound();
  const allPlaces = await getCityEstablishments(params.slug);
  const similar = allPlaces.filter(e => e.categorySlug === place.categorySlug && e.id !== place.id).slice(0, 3);
  const category = CATEGORIES.find(c => c.slug === place.categorySlug);

  const featureList = [
    { key: 'waterBowl', label: 'Water Bowls', icon: '\ud83d\udca7', active: place.dogFeatures?.waterBowl },
    { key: 'treats', label: 'Dog Treats', icon: '\ud83e\uddb4', active: place.dogFeatures?.treats },
    { key: 'outdoorSeating', label: 'Outdoor Seating', icon: '\u2600\ufe0f', active: place.dogFeatures?.outdoorSeating },
    { key: 'indoorAllowed', label: 'Dogs Inside', icon: '\ud83c\udfe0', active: place.dogFeatures?.indoorAllowed },
    { key: 'offLeashArea', label: 'Off-Leash', icon: '\ud83d\udc15', active: place.dogFeatures?.offLeashArea },
    { key: 'dogMenu', label: 'Dog Menu', icon: '\ud83c\udf56', active: place.dogFeatures?.dogMenu },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4"><div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2"><span className="text-2xl">\ud83d\udc3e</span><span className="font-display text-xl font-bold text-primary-600">PawsCities</span></Link>
          <Link href={`/${city.slug}`} className="text-gray-600 hover:text-primary-600">\u2190 Back to {city.name}</Link>
        </div></div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary-100 text-primary-700 text-sm px-3 py-1 rounded-full">{category?.name}</span>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">{place.name}</h1>
          <p className="text-gray-500">{place.address}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-6 mb-4">
                <div className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold">\u2605 {place.rating?.toFixed(1) || 'N/A'}</div>
                <span className="text-gray-500 text-sm">{place.reviewCount || 0} reviews</span>
                {place.neighborhood && <span className="text-gray-500 text-sm">{place.neighborhood}</span>}
              </div>
              <p className="text-gray-700 leading-relaxed">{place.description}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold mb-4">Dog-Friendly Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {featureList.map(f => (
                  <div key={f.key} className={`flex items-center gap-2 p-3 rounded-lg border ${f.active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    <span>{f.icon}</span><span className="text-sm font-medium">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Contact Info</h3>
              <div className="space-y-3">
                <div className="text-sm text-gray-700">{place.address}</div>
                {place.phone && <a href={`tel:${place.phone}`} className="text-sm text-primary-600 hover:underline block">{place.phone}</a>}
                {place.website && <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline block truncate">{place.website}</a>}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {place.website && <a href={place.website} target="_blank" rel="noopener noreferrer" className="bg-primary-600 text-white text-center text-sm py-2 px-4 rounded-xl hover:bg-primary-700">Visit Website</a>}
              </div>
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-bold mb-6">More {category?.name} in {city.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similar.map(s => (
                <Link key={s.id} href={`/${city.slug}/${s.slug}`} className="group bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all">
                  <div className="p-4"><h3 className="font-semibold">{s.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><span>{s.neighborhood}</span></div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <footer className="bg-gray-900 text-gray-300 py-8 px-4 mt-8"><div className="container mx-auto flex justify-between items-center">
        <span className="font-display text-xl font-bold text-white">PawsCities</span>
        <p className="text-sm text-gray-500">2026 PawsCities</p>
      </div></footer>
    </div>
  );
}

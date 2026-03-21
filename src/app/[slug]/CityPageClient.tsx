'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui';
import type { CityConfig } from '@/lib/cities-config';
import type { Establishment, CategorySlug } from '@/types';
import { PremiumCard } from '@/components/ListingBadges';

// Dynamic import for MapView to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/map/MapView').then(mod => ({ default: mod.MapView })), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center"><span className="text-gray-400">Loading map...</span></div>,
});

// Client-side emoji map to avoid UTF-8 serialization issues across the RSC boundary
const CATEGORY_ICONS: Record<string, string> = {
  parks: '\u{1F333}',        // ð³
  restaurants: '\u{1F37D}\uFE0F', // ð½ï¸
  cafes: '\u2615',           // â
  hotels: '\u{1F3E8}',       // ð¨
  beaches: '\u{1F3D6}\uFE0F', // ðï¸
  vets: '\u{1F3E5}',         // ð¥
  groomers: '\u2702\uFE0F',  // âï¸
  shops: '\u{1F6CD}\uFE0F',  // ðï¸
  activities: '\u{1F3BE}',   // ð¾
  walkers: '\u{1F9AE}',      // ð¦®
  trainers: '\u{1F393}',     // ð
  daycare: '\u{1F3E0}',      // ð 
};

function getCategoryIcon(slug: string): string {
  return CATEGORY_ICONS[slug] || '\u{1F43E}'; // ð¾ fallback
}

// Fallback image for when Unsplash images fail to load
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop';

interface WeatherData {
  temperature: number;
  temperatureUnit: string;
  condition: string;
  description: string;
  icon: string;
  suggestIndoor: boolean;
  windSpeed: number;
}

function WeatherBanner({ lat, lng, cityName }: { lat: number; lng: number; cityName: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch(`/api/weather?lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setWeather(data);
      })
      .catch(() => {});
  }, [lat, lng]);

  if (!weather) return null;

  const bgClass = weather.suggestIndoor
    ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200'
    : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';

  const recommendation = weather.suggestIndoor
    ? 'Showing indoor-friendly spots first!'
    : weather.condition === 'clear'
      ? 'Perfect weather for outdoor spots!'
      : 'Enjoy exploring with your pup!';

  return (
    <div className={`rounded-xl border p-3 mb-4 flex items-center gap-3 ${bgClass}`}>
      <span className="text-2xl">{weather.icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">
            {weather.temperature}{weather.temperatureUnit}
          </span>
          <span className="text-gray-600 text-sm">{weather.description} in {cityName}</span>
        </div>
        <p className="text-sm text-gray-500">{recommendation}</p>
      </div>
      {weather.suggestIndoor && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
          Indoor recommended
        </span>
      )}
    </div>
  );
}

interface CityPageClientProps {
  city: CityConfig;
  establishments: Establishment[];
  categoryCounts: Record<string, number>;
  categories: { slug: string; name: string; nameFr: string; icon: string; color: string }[];
}

export function CityPageClient({ city, establishments, categoryCounts, categories }: CityPageClientProps) {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || null;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedMapPlace, setSelectedMapPlace] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Fetch weather data for smart sorting
  useEffect(() => {
    fetch(`/api/weather?lat=${city.latitude}&lon=${city.longitude}`)
      .then(res => res.json())
      .then(data => { if (!data.error) setWeather(data); })
      .catch(() => {});
  }, [city.latitude, city.longitude]);

  const filtered = useMemo(() => {
    let result = establishments;
    if (selectedCategory) {
      result = result.filter(e => e.categorySlug === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.neighborhood && e.neighborhood.toLowerCase().includes(q))
      );
    }
    // Smart weather sorting: when indoor is recommended, prioritize indoor-friendly places
    if (weather?.suggestIndoor && !selectedCategory) {
      result = [...result].sort((a, b) => {
        const aIndoor = a.dogFeatures.indoorAllowed ? 1 : 0;
        const bIndoor = b.dogFeatures.indoorAllowed ? 1 : 0;
        return bIndoor - aIndoor;
      });
    }
    return result;
  }, [establishments, selectedCategory, searchQuery, weather]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const totalPlaces = establishments.length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <section className="relative h-64 md:h-80 overflow-hidden">
        <img src={city.heroImage} alt={city.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
          <div className="container mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">{city.country}</span>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-bold mb-2">{city.name}</h1>
            <p className="text-white/90 max-w-2xl text-sm md:text-base">{city.description}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-white/80">
              <span>{getCategoryIcon('parks')} {totalPlaces} dog-friendly places</span>
              <span>{'\u2022'}</span>
              <span>{getCategoryIcon('parks')} {categoryCounts['parks'] || 0} parks</span>
              <span>{'\u2022'}</span>
              <span>{getCategoryIcon('restaurants')} {categoryCounts['restaurants'] || 0} restaurants</span>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <div className="container mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
          {/* Weather Banner */}
          <WeatherBanner lat={city.latitude} lng={city.longitude} cityName={city.name} />

          {/* Search */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${totalPlaces} places in ${city.name}...`}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${viewMode === 'map' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              </button>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`filter-chip ${selectedCategory === null ? 'active' : ''}`}
            >
              {'\u{1F43E}'} All ({totalPlaces})
            </button>
            {categories.map((cat) => {
              const count = categoryCounts[cat.slug] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                  className={`filter-chip ${selectedCategory === cat.slug ? 'active' : ''}`}
                >
                  {getCategoryIcon(cat.slug)} {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {filtered.length === totalPlaces
              ? `Showing all ${totalPlaces} places`
              : `${filtered.length} of ${totalPlaces} places`}
            {selectedCategory && ` in ${categories.find(c => c.slug === selectedCategory)?.name}`}
            {searchQuery && ` matching "${searchQuery}"`}
            {weather?.suggestIndoor && !selectedCategory && ' (indoor-friendly first)'}
          </p>
        </div>

        {viewMode === 'map' ? (
          <div className="h-[350px] sm:h-[450px] md:h-[600px] rounded-2xl overflow-hidden shadow-lg">
            <MapView
              establishments={filtered}
              center={{ lat: city.latitude, lng: city.longitude }}
              zoom={city.zoomLevel}
              selectedId={selectedMapPlace}
              onMarkerClick={(e) => setSelectedMapPlace(e.id)}
              lang="en"
              className="h-full"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <div className="text-6xl mb-4">{'\u{1F415}'}</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No places found</h3>
                <p className="text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              filtered.map((establishment) => (
                <Link
                  key={establishment.id}
                  href={`/${city.slug}/${establishment.slug}`}
                  className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden bg-gray-100">
                    <img
                      src={establishment.images[0]}
                      alt={establishment.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const currentSrc = img.src;
                        // Track retry count to prevent infinite loops
                        const retryCount = parseInt(img.dataset.retryCount || '0', 10);
                        const images = establishment.images;

                        if (retryCount < images.length) {
                          // Try next image in the array
                          const nextIdx = retryCount + 1;
                          if (nextIdx < images.length) {
                            img.dataset.retryCount = String(nextIdx);
                            img.src = images[nextIdx];
                          } else if (!currentSrc.includes('unsplash.com')) {
                            // All images exhausted, use ultimate fallback
                            img.dataset.retryCount = String(images.length);
                            img.src = FALLBACK_IMAGE;
                          }
                        }
                      }}
                    />
                    {/* Favorite button */}
                    <button
                      onClick={(e) => { e.preventDefault(); toggleFavorite(establishment.id); }}
                      className={`absolute top-3 right-3 p-2 rounded-full transition-all ${favorites.includes(establishment.id) ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600 hover:text-red-500'}`}
                    >
                      <svg className="w-4 h-4" fill={favorites.includes(establishment.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    {/* Premium/Verified overlay */}
                    <PremiumCard tier={(establishment as any).tier || 'FREE'} />
                    {/* Category badge */}
                    <div className="absolute top-3 left-3">
                      <Badge variant="category">
                        {getCategoryIcon(establishment.categorySlug)} {categories.find(c => c.slug === establishment.categorySlug)?.name}
                      </Badge>
                    </div>
                    {establishment.isFeatured && (
                      <div className="absolute bottom-3 left-3">
                        <Badge variant="premium">{'\u2B50'} Featured</Badge>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{establishment.name}</h3>
                      {establishment.isVerified && <Badge variant="verified" className="shrink-0">{'\u2713'}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mb-2 text-sm">
                      <span className="flex items-center gap-1"><span className="text-yellow-500">{'\u2605'}</span> <span className="font-medium">{establishment.rating.toFixed(1)}</span> {establishment.reviewCount > 0 && <span className="text-gray-400">({establishment.reviewCount})</span>}</span>
                      <span className="text-gray-300">{'\u2022'}</span>
                      <span className="text-gray-600">{'\u20AC'.repeat(establishment.priceLevel)}</span>
                      {establishment.neighborhood && (<><span className="text-gray-300">{'\u2022'}</span><span className="text-gray-500 text-xs">{establishment.neighborhood}</span></>)}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{establishment.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {establishment.dogFeatures.waterBowl && <span className="feature-tag" title="Water Bowl">{'\u{1F4A7}'}</span>}
                      {establishment.dogFeatures.treats && <span className="feature-tag" title="Treats">{'\u{1F9B4}'}</span>}
                      {establishment.dogFeatures.outdoorSeating && <span className="feature-tag" title="Outdoor Seating">{'\u2600\uFE0F'}</span>}
                      {establishment.dogFeatures.indoorAllowed && <span className="feature-tag" title="Dogs Inside">{'\u{1F3E0}'}</span>}
                      {establishment.dogFeatures.offLeashArea && <span className="feature-tag" title="Off-Leash">{'\u{1F415}'}</span>}
                      {establishment.dogFeatures.fenced && <span className="feature-tag" title="Fenced">{'\u{1F512}'}</span>}
                      {establishment.dogFeatures.dogMenu && <span className="feature-tag" title="Dog Menu">{'\u{1F356}'}</span>}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* List Your Business CTA */}
      <section className="bg-gradient-to-r from-primary-500 to-primary-600 py-10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
            Own a dog-friendly business in {city.name}?
          </h2>
          <p className="text-white/90 mb-6 max-w-xl mx-auto">
            Get discovered by thousands of dog owners. Claim your free listing or add your business today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/business/claim"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Claim Your Listing
            </Link>
            <Link
              href="/for-business"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-colors border border-white/30"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Dog Regulations */}
      <section className="bg-white border-t py-8">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-xl font-bold mb-4">{'\u{1F415}'} Dog Regulations in {city.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold mb-1">Leash Policy</h3>
              <p className="text-sm text-gray-600">{city.dogRegulations.leashRequired ? 'Leash required in most public areas' : 'Leash not required in most areas'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold mb-1">Off-Leash Areas</h3>
              <p className="text-sm text-gray-600">{city.dogRegulations.offLeashAreas ? 'Designated off-leash areas available' : 'Limited off-leash options'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold mb-1">Public Transport</h3>
              <p className="text-sm text-gray-600">{city.dogRegulations.publicTransport}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{'\u{1F43E}'}</span>
            <span className="font-display text-xl font-bold text-white">Paw Cities</span>
          </div>
          <p className="text-sm text-gray-500">{'\u00A9'} 2026 Paw Cities. Made with love for dogs and their humans.</p>
        </div>
      </footer>
    </div>
  );
}

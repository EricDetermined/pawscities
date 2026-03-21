'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CityConfig } from '@/lib/cities-config';

const CATEGORIES = [
  { slug: 'parks', icon: '🌳', label: 'Parks' },
  { slug: 'restaurants', icon: '🍽️', label: 'Restaurants' },
  { slug: 'cafes', icon: '☕', label: 'Cafes' },
  { slug: 'hotels', icon: '🏨', label: 'Hotels' },
  { slug: 'beaches', icon: '🏖️', label: 'Beaches' },
  { slug: 'vets', icon: '🏥', label: 'Vets' },
];

interface HomePageClientProps {
  cities: CityConfig[];
  cityCounts: Record<string, number>;
}

export default function HomePageClient({ cities, cityCounts }: HomePageClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [nearestCity, setNearestCity] = useState<CityConfig | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find nearest city using geolocation
  const handleExploreNearMe = () => {
    if (!navigator.geolocation) return;
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        let closest: CityConfig | null = null;
        let minDist = Infinity;
        cities.forEach((city) => {
          const dist = Math.sqrt(
            Math.pow(city.latitude - latitude, 2) +
            Math.pow(city.longitude - longitude, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            closest = city;
          }
        });
        setLocatingUser(false);
        if (closest) {
          setNearestCity(closest);
          router.push(`/${(closest as CityConfig).slug}`);
        }
      },
      () => {
        setLocatingUser(false);
      },
      { timeout: 8000 }
    );
  };

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    // Check if query matches a city name
    const matchedCity = cities.find(
      (c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)
    );
    if (matchedCity) {
      router.push(`/${matchedCity.slug}`);
      return;
    }

    // Check if query matches a category
    const matchedCat = CATEGORIES.find(
      (c) => c.label.toLowerCase().includes(q) || c.slug.includes(q)
    );
    if (matchedCat) {
      // Go to first city with that category filter
      router.push(`/${cities[0].slug}?category=${matchedCat.slug}`);
      return;
    }

    // Default: go to first city with search query
    router.push(`/${cities[0].slug}?search=${encodeURIComponent(q)}`);
  };

  // Handle category click — navigate to first city filtered by category
  const handleCategoryClick = (slug: string) => {
    setActiveCategory(slug === activeCategory ? null : slug);
    // Navigate to cities section with a scroll, or to first city
    const citiesSection = document.getElementById('cities-section');
    if (citiesSection) {
      citiesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Business Banner — Top */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
          <span className="hidden sm:inline">🐾</span>
          <span className="font-medium">Dog-friendly business?</span>
          <Link
            href="/for-business"
            className="underline underline-offset-2 font-semibold hover:text-white/90 transition-colors"
          >
            List for free
          </Link>
          <span className="text-white/70 hidden sm:inline">— reach dog owners in 8 cities worldwide</span>
        </div>
      </div>

      {/* Hero — Split Layout */}
      <section className="relative flex flex-col md:flex-row min-h-[520px]">
        {/* Left: Content Panel */}
        <div className="flex-1 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex flex-col justify-center px-8 md:px-14 py-14 md:py-20">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Find Dog-Friendly<br />Places
          </h1>
          <p className="text-base md:text-lg text-white/90 max-w-md mb-7 leading-relaxed">
            Discover the best restaurants, cafes, parks, and more that welcome
            your furry friend in cities around the world.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-6 max-w-lg">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city, park, cafe..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/25 text-white placeholder-white/50 focus:bg-white/15 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors text-sm whitespace-nowrap"
              >
                Search
              </button>
            </div>
          </form>

          {/* Explore Near Me Button */}
          <div className="mb-7">
            <button
              onClick={handleExploreNearMe}
              disabled={locatingUser}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 text-sm hover:bg-white/15 hover:border-white/30 transition-all disabled:opacity-50"
            >
              {locatingUser ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Finding your location...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Explore Near Me
                </>
              )}
            </button>
          </div>

          {/* Category Filters — Interactive */}
          <div className="flex flex-wrap gap-2 text-sm">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => handleCategoryClick(cat.slug)}
                className={`px-4 py-2 rounded-full transition-all cursor-pointer ${
                  activeCategory === cat.slug
                    ? 'bg-orange-500 border border-orange-400 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-white/15 border border-white/25 text-white backdrop-blur-sm hover:bg-white/25 hover:border-white/40'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Dog Photo */}
        <div className="flex-1 relative overflow-hidden min-h-[280px] md:min-h-0">
          <img
            src="/images/hero-dogs.jpg"
            alt="Two adorable dogs — the Paw Cities mascots"
            className="w-full h-full object-cover object-center"
          />
          {/* Gradient blend from left panel into image */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-[#16213e] to-transparent w-24" />
        </div>
      </section>

      {/* Cities Grid */}
      <section id="cities-section" className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="font-display text-3xl font-bold mb-2">Explore Cities</h2>
          <p className="text-gray-600 mb-8">
            Find dog-friendly places in {cities.length} amazing destinations
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cities.map((city) => {
              const count = cityCounts[city.slug] || 0;
              const href = activeCategory
                ? `/${city.slug}?category=${activeCategory}`
                : `/${city.slug}`;
              return (
                <Link
                  key={city.slug}
                  href={href}
                  className="group relative h-72 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                >
                  <img
                    src={city.heroImage}
                    alt={city.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        {city.country}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-bold mb-1">{city.name}</h3>
                    <p className="text-sm opacity-90">
                      {count > 0
                        ? `${count} dog-friendly place${count !== 1 ? 's' : ''}`
                        : 'Explore dog-friendly places'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto">
          <h2 className="font-display text-3xl font-bold mb-8 text-center">
            Why Paw Cities?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl mb-4">🗺️</div>
              <h3 className="font-semibold text-lg mb-2">Interactive Maps</h3>
              <p className="text-gray-600">
                Find nearby dog-friendly places with our easy-to-use map interface.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="font-semibold text-lg mb-2">8 Global Cities</h3>
              <p className="text-gray-600">
                From Paris to Tokyo, discover dog-friendly spots wherever you travel.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl mb-4">🐾</div>
              <h3 className="font-semibold text-lg mb-2">Dog-Specific Features</h3>
              <p className="text-gray-600">
                Filter by water bowls, off-leash areas, dog menus, and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community CTA */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
                Know a dog-friendly spot?
              </h3>
              <p className="text-gray-600 text-sm">
                Help fellow dog owners discover great places. Share your favorite spots with the community.
              </p>
            </div>
            <Link
              href="/business/claim"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap text-sm"
            >
              <span>🐾</span> Share a Place
            </Link>
          </div>
        </div>
      </section>

      {/* Business CTA — Enhanced */}
      <section className="py-16 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="container mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Own a Dog-Friendly Business?
          </h2>
          <p className="text-lg opacity-90 max-w-xl mx-auto mb-8">
            Claim your free listing, manage your profile, and reach thousands of
            dog owners looking for places like yours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/for-business"
              className="inline-block px-8 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors shadow-lg"
            >
              List Your Business Free
            </Link>
            <Link
              href="/for-business#pricing"
              className="inline-block px-8 py-3 bg-white/15 border border-white/30 text-white rounded-xl font-bold hover:bg-white/25 transition-colors"
            >
              View Premium Plans
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-white">
                Paw Cities
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a
                href="https://instagram.com/thepawcities"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
                @thepawcities
              </a>
              <Link
                href="/for-business"
                className="hover:text-white transition-colors"
              >
                For Business
              </Link>
              <Link
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="hover:text-white transition-colors"
              >
                Terms
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              &copy; 2026 Paw Cities. Made with love for dogs and their humans.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

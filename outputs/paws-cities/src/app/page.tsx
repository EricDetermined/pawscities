'use client';

import Link from 'next/link';
import { CITIES } from '@/lib/cities-config';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import { isAdmin } from '@/lib/admin';

export default function HomePage() {
  const { user } = useAuth();
  const cities = Object.values(CITIES);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-primary-600">PawsCities</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/" className="nav-link active">Home</Link>
              {user && isAdmin(user.email) && (
                <Link href="/admin" className="nav-link">Admin</Link>
              )}
            </nav>
            <div className="flex items-center gap-4">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Hero — Split Layout */}
      <section className="relative flex flex-col md:flex-row min-h-[480px]">
        {/* Left: Content Panel */}
        <div className="flex-1 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex flex-col justify-center px-8 md:px-14 py-16 md:py-20">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
            Find Dog-Friendly<br />Places
          </h1>
          <p className="text-base md:text-lg text-white/90 max-w-md mb-8 leading-relaxed">
            Discover the best restaurants, cafes, parks, and more that welcome
            your furry friend in cities around the world.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="bg-white/15 border border-white/25 px-4 py-2 rounded-full text-white backdrop-blur-sm">🌳 Parks</span>
            <span className="bg-white/15 border border-white/25 px-4 py-2 rounded-full text-white backdrop-blur-sm">🍽️ Restaurants</span>
            <span className="bg-white/15 border border-white/25 px-4 py-2 rounded-full text-white backdrop-blur-sm">☕ Cafes</span>
            <span className="bg-white/15 border border-white/25 px-4 py-2 rounded-full text-white backdrop-blur-sm">🏨 Hotels</span>
            <span className="bg-white/15 border border-white/25 px-4 py-2 rounded-full text-white backdrop-blur-sm">🏖️ Beaches</span>
            <span className="bg-white/15 border border-white/25 px-4 py-2 rounded-full text-white backdrop-blur-sm">🏥 Vets</span>
          </div>
        </div>
        {/* Right: Dog Photo */}
        <div className="flex-1 relative overflow-hidden min-h-[280px] md:min-h-0">
          <img
            src="/images/hero-dogs.jpg"
            alt="Two adorable dogs — the PawCities mascots"
            className="w-full h-full object-cover object-center"
          />
          {/* Gradient blend from left panel into image */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-[#16213e] to-transparent w-24" />
        </div>
      </section>

      {/* Cities Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="font-display text-3xl font-bold mb-2">Explore Cities</h2>
          <p className="text-gray-600 mb-8">Find dog-friendly places in {cities.length} amazing destinations</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cities.map((city) => (
              <Link
                key={city.slug}
                href={`/${city.slug}`}
                className="group relative h-72 rounded-2xl overflow-hidden shadow-lg"
              >
                <img
                  src={city.heroImage}
                  alt={city.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{city.country}</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold mb-1">{city.name}</h3>
                  <p className="text-sm opacity-90">Explore dog-friendly places</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto">
          <h2 className="font-display text-3xl font-bold mb-8 text-center">Why PawsCities?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl mb-4">🗺️</div>
              <h3 className="font-semibold text-lg mb-2">Interactive Maps</h3>
              <p className="text-gray-600">Find nearby dog-friendly places with our easy-to-use map interface.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="font-semibold text-lg mb-2">8 Global Cities</h3>
              <p className="text-gray-600">From Paris to Tokyo, discover dog-friendly spots wherever you travel.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl mb-4">🐾</div>
              <h3 className="font-semibold text-lg mb-2">Dog-Specific Features</h3>
              <p className="text-gray-600">Filter by water bowls, off-leash areas, dog menus, and more.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-white">PawsCities</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-gray-500">&copy; 2026 PawsCities. Made with love for dogs and their humans.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

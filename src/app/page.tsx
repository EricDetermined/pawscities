import Link from 'next/link';
import { CITIES } from '@/lib/cities-config';

export default function HomePage() {
  const cities = Object.values(CITIES);

  return (
    <div className="min-h-screen">
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
            alt="Two adorable dogs — the Paw Cities mascots"
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
          <h2 className="font-display text-3xl font-bold mb-8 text-center">Why Paw Cities?</h2>
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

      {/* Business CTA */}
      <section className="py-16 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="container mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-4">Own a Dog-Friendly Business?</h2>
          <p className="text-lg opacity-90 max-w-xl mx-auto mb-8">
            Claim your free listing, manage your profile, and reach thousands of dog owners looking for places like yours.
          </p>
          <Link
            href="/for-business"
            className="inline-block px-8 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors shadow-lg"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-white">Paw Cities</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="https://instagram.com/thepawcities" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                @thepawcities
              </a>
              <Link href="/for-business" className="hover:text-white transition-colors">For Business</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-gray-500">&copy; 2026 Paw Cities. Made with love for dogs and their humans.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';

const CITIES = [
  { name: 'Paris', slug: 'paris', country: 'France', emoji: '🇫🇷', places: 35 },
  { name: 'London', slug: 'london', country: 'UK', emoji: '🇬🇧', places: 42 },
  { name: 'New York', slug: 'new-york', country: 'USA', emoji: '🇺🇸', places: 38 },
  { name: 'Los Angeles', slug: 'los-angeles', country: 'USA', emoji: '🇺🇸', places: 45 },
  { name: 'Barcelona', slug: 'barcelona', country: 'Spain', emoji: '🇪🇸', places: 32 },
  { name: 'Tokyo', slug: 'tokyo', country: 'Japan', emoji: '🇯🇵', places: 28 },
  { name: 'Sydney', slug: 'sydney', country: 'Australia', emoji: '🇦🇺', places: 25 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">🐾</span>
            <span className="text-2xl font-bold text-amber-600">PawsCities</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-amber-600">Log In</Link>
            <Link href="/signup" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
          Explore the World<br />
          <span className="text-amber-500">With Your Best Friend</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Discover dog-friendly cafes, restaurants, parks, and more in cities around the world.
        </p>
        <div className="flex justify-center gap-12 mb-16">
          {[
            { value: '245+', label: 'Places' },
            { value: '7', label: 'Cities' },
            { value: '5K+', label: 'Happy Dogs' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl font-bold text-amber-500">{stat.value}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Cities */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Explore Dog-Friendly Cities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {CITIES.map((city) => (
            <Link
              key={city.slug}
              href={`/${city.slug}`}
              className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden"
            >
              <div className="h-40 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <span className="text-6xl group-hover:scale-110 transition-transform">{city.emoji}</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-amber-600">{city.name}</h3>
                <p className="text-gray-500">{city.country}</p>
                <div className="mt-3 flex items-center text-amber-600">
                  <span className="text-sm font-medium">{city.places} places</span>
                  <span className="ml-auto">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🐾</span>
            <span className="text-xl font-bold">PawsCities</span>
          </div>
          <p className="text-gray-400">Helping dogs and their humans explore the world together.</p>
          <p className="text-gray-500 mt-4">© {new Date().getFullYear()} PawsCities</p>
        </div>
      </footer>
    </div>
  );
}

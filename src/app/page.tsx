import Link from 'next/link'

const featuredCities = [
  { name: 'Austin', slug: 'austin', state: 'TX', count: 245 },
  { name: 'Denver', slug: 'denver', state: 'CO', count: 189 },
  { name: 'Portland', slug: 'portland', state: 'OR', count: 167 },
  { name: 'San Diego', slug: 'san-diego', state: 'CA', count: 298 },
  { name: 'Seattle', slug: 'seattle', state: 'WA', count: 212 },
  { name: 'Nashville', slug: 'nashville', state: 'TN', count: 156 },
]

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Find Dog-Friendly Places Near You
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Discover restaurants, cafes, parks, and more that welcome your furry friend
          </p>
          <Link 
            href="/cities"
            className="bg-white text-amber-600 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition"
          >
            Explore Cities
          </Link>
        </div>
      </section>

      {/* Featured Cities */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Popular Cities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCities.map((city) => (
              <Link 
                key={city.slug}
                href={`/cities/${city.slug}`}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <h3 className="text-xl font-semibold">{city.name}, {city.state}</h3>
                <p className="text-gray-600">{city.count} dog-friendly places</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-amber-600">50+</p>
              <p className="text-gray-600">Cities</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-amber-600">5,000+</p>
              <p className="text-gray-600">Dog-Friendly Places</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-amber-600">25,000+</p>
              <p className="text-gray-600">Happy Dogs</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

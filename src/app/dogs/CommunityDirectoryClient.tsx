'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DirectoryDog {
  id: string;
  slug: string;
  name: string;
  breed: string | null;
  birthDate: string | null;
  size: string | null;
  bio: string | null;
  photo: string | null;
  owner: { id: string; name: string | null; avatar: string | null } | null;
  city: { slug: string; name: string } | null;
}

interface CityOption {
  slug: string;
  name: string;
}

const PAGE_SIZE = 24;

function dogAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years > 0) return `${years} yr${years !== 1 ? 's' : ''}`;
  if (months > 0) return `${months} mo`;
  return 'Puppy';
}

export function CommunityDirectoryClient() {
  const [dogs, setDogs] = useState<DirectoryDog[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [total, setTotal] = useState(0);
  const [city, setCity] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async (citySlug: string, term: string, pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (citySlug) params.set('city', citySlug);
      if (term) params.set('search', term);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(pageNum * PAGE_SIZE));
      const res = await fetch(`/api/community/dogs?${params.toString()}`);
      const data = await res.json();
      setDogs(data.dogs || []);
      setTotal(data.total || 0);
      if (data.cities) setCities(data.cities);
    } catch {
      setDogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(city, search, page);
  }, [city, page, load]); // search triggers via submit

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load(city, search, 0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Meet the Dogs of Paw Cities 🐾</h1>
          <p className="text-orange-50 max-w-2xl mx-auto">
            The pups behind the community. Browse dogs by city, follow their owners, and
            build your local pack.
          </p>
          <div className="mt-6">
            <Link
              href="/profile/dogs/new"
              className="inline-block px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
            >
              Add your dog
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setCity(''); setPage(0); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                city === ''
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
            >
              All cities
            </button>
            {cities.map((c) => (
              <button
                key={c.slug}
                onClick={() => { setCity(c.slug); setPage(0); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  city === c.slug
                    ? 'bg-orange-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="sm:ml-auto flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none w-full sm:w-56"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Loading dogs...
          </div>
        ) : dogs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <span className="text-5xl block mb-4">🐕</span>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No public dog profiles here yet
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Be the first! Add your dog and flip on &quot;Show on Paw Cities&quot; to
              put your pup on the map.
            </p>
            <Link
              href="/profile/dogs/new"
              className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              🐾 Add your dog
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {total} dog{total !== 1 ? 's' : ''}
              {city && cities.find(c => c.slug === city)
                ? ` in ${cities.find(c => c.slug === city)!.name}`
                : ' across all cities'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {dogs.map((dog) => (
                <Link
                  key={dog.id}
                  href={`/dogs/${dog.slug}`}
                  className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-orange-200 transition-all"
                >
                  <div className="aspect-square bg-orange-50 relative overflow-hidden">
                    {dog.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dog.photo}
                        alt={dog.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        🐶
                      </div>
                    )}
                    {dog.city && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-700">
                        📍 {dog.city.name}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{dog.name}</h3>
                      {dogAge(dog.birthDate) && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {dogAge(dog.birthDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {dog.breed || 'Mixed breed'}
                    </p>
                    {dog.owner?.name && (
                      <p className="text-xs text-gray-400 mt-2 truncate">
                        with {dog.owner.name}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500 px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Favorite {
  id: string;
  establishment_id: string;
  establishments: {
    name: string;
    slug: string;
    address: string;
    primary_image: string | null;
    rating: number;
    city_id: string;
    cities: { slug: string } | null;
  } | null;
  created_at: string;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/favorites')
      .then(res => res.json())
      .then(data => setFavorites(data.favorites || []))
      .catch(() => setError('Failed to load favorites'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading saved places...</div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Saved Places</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {favorites.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">❤️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No saved places yet</h2>
          <p className="text-gray-500 mb-6">When you find a dog-friendly spot you love, save it here for easy access.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">
            Explore Cities
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {favorites.map(fav => {
            const est = fav.establishments;
            const citySlug = est?.cities?.slug;
            const href = est && citySlug ? `/${citySlug}/${est.slug}` : null;

            return (
              <div key={fav.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-orange-300 hover:shadow-sm transition-all">
                {est ? (
                  href ? (
                    <Link href={href} className="flex items-center gap-4 p-4">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                        {est.primary_image ? (
                          <img src={est.primary_image} alt={est.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">📍</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{est.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{est.address}</p>
                        {est.rating > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-500 text-xs">&#9733;</span>
                            <span className="text-xs text-gray-600">{est.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                        {est.primary_image ? (
                          <img src={est.primary_image} alt={est.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">📍</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{est.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{est.address}</p>
                        {est.rating > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-500 text-xs">&#9733;</span>
                            <span className="text-xs text-gray-600">{est.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-4 text-sm text-gray-400">Place no longer available</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

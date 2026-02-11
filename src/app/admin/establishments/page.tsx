'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Establishment {
  id: string;
  name: string;
  category: string;
  city_id: string;
  status: string;
  tier: string;
  rating: number;
  reviews_count: number;
  claimed_by?: string;
  cities?: {
    id: string;
    name: string;
  };
}

interface EstablishmentsResponse {
  establishments: Establishment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function EstablishmentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EstablishmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const fetchEstablishments = useCallback(
    async (pageNum: number = 1) => {
      try {
        setLoading(true);
        const url = new URL('/api/admin/establishments', window.location.origin);
        url.searchParams.set('page', pageNum.toString());
        url.searchParams.set('limit', '20');

        if (searchQuery) url.searchParams.set('search', searchQuery);
        if (cityFilter !== 'all') url.searchParams.set('city', cityFilter);
        if (categoryFilter !== 'all')
          url.searchParams.set('category', categoryFilter);
        if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch establishments');
        }
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        console.error('Error fetching establishments:', err);
        setError('Failed to load establishments');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, categoryFilter, cityFilter, statusFilter]
  );

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);

    const timeout = setTimeout(() => {
      setPage(1);
      fetchEstablishments(1);
    }, 300);

    setSearchTimeout(timeout);

    return () => clearTimeout(timeout);
  }, [searchQuery, categoryFilter, cityFilter, statusFilter, fetchEstablishments]);

  useEffect(() => {
    if (page !== 1) {
      fetchEstablishments(page);
    }
  }, [page, fetchEstablishments]);

  const categoryIcons: Record<string, string> = {
    restaurants: '🍽️',
    cafes: '☕',
    parks: '🌳',
    hotels: '🏨',
    vets: '🏥',
    groomers: '✂️',
    shops: '🛍️',
    activities: '🎾',
  };

  const tierColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    claimed: 'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Establishments</h1>
          <p className="text-gray-600">
            Manage dog-friendly places across all cities
          </p>
        </div>
        <Link
          href="/admin/establishments/new"
          className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Establishment
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
              type="search"
              placeholder="Search establishments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* City Filter */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Cities</option>
            <option value="geneva">Geneva</option>
            <option value="paris">Paris</option>
            <option value="london">London</option>
            <option value="losangeles">Los Angeles</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Categories</option>
            <option value="restaurants">Restaurants</option>
            <option value="cafes">Cafes</option>
            <option value="parks">Parks</option>
            <option value="hotels">Hotels</option>
            <option value="vets">Vets</option>
            <option value="groomers">Groomers</option>
            <option value="shops">Shops</option>
            <option value="activities">Activities</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results Count */}
      {data && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>
            {data.establishments.length > 0
              ? `Showing ${data.establishments.length} of ${data.pagination.total} establishments`
              : 'No establishments found'}
          </p>
        </div>
      )}

      {/* Establishments Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : data && data.establishments.length > 0 ? (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Establishment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.establishments.map((est) => (
                  <EstablishmentRow
                    key={est.id}
                    establishment={est}
                    categoryIcons={categoryIcons}
                    tierColors={tierColors}
                  />
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Page {data.pagination.page} of {data.pagination.pages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
                  {page}
                </span>
                <button
                  onClick={() =>
                    setPage(Math.min(data.pagination.pages, page + 1))
                  }
                  disabled={page >= data.pagination.pages}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No establishments found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EstablishmentRow({
  establishment,
  categoryIcons,
  tierColors,
}: {
  establishment: Establishment;
  categoryIcons: Record<string, string>;
  tierColors: Record<string, string>;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <p className="font-medium text-gray-900">{establishment.name}</p>
          <p className="text-sm text-gray-500">
            ID: {establishment.id.slice(0, 8)}
          </p>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm">
          {categoryIcons[establishment.category] || '📍'}
          <span className="capitalize">{establishment.category}</span>
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-gray-900 capitalize">
          {establishment.cities?.name || 'Unknown'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">★</span>
          <span className="font-medium">{establishment.rating.toFixed(1)}</span>
          <span className="text-gray-400">({establishment.reviews_count})</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
            tierColors[establishment.tier]
          }`}
        >
          {establishment.tier}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            establishment.status === 'ACTIVE'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {establishment.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="relative inline-block">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20">
                <Link
                  href={`/admin/establishments/${establishment.id}`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  View Details
                </Link>
                <Link
                  href={`/admin/establishments/${establishment.id}/edit`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </Link>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Toggle Featured
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Toggle Verified
                </button>
                <hr className="my-1" />
                <button className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Deactivate
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

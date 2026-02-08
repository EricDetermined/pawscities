'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GENEVA_ESTABLISHMENTS } from '@/data/geneva-establishments';
import { CATEGORIES } from '@/lib/cities-config';
import { getCategoryIcon } from '@/lib/categories';

export default function EstablishmentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
      <EstablishmentsContent />
    </Suspense>
  );
}

function EstablishmentsContent() {
  const searchParams = useSearchParams();
  const cityFilter = searchParams.get('city') || 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Use Geneva data as mock
  const establishments = GENEVA_ESTABLISHMENTS;

  const filteredEstablishments = useMemo(() => {
    return establishments.filter((est) => {
      const matchesSearch =
        est.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        est.address.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCity = cityFilter === 'all' || est.citySlug === cityFilter;
      const matchesCategory =
        categoryFilter === 'all' || est.categorySlug === categoryFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'verified' && est.isVerified) ||
        (statusFilter === 'featured' && est.isFeatured) ||
        (statusFilter === 'pending' && !est.isVerified);

      return matchesSearch && matchesCity && matchesCategory && matchesStatus;
    });
  }, [establishments, searchQuery, cityFilter, categoryFilter, statusFilter]);

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
            onChange={(e) => {
              // Update URL params
              const url = new URL(window.location.href);
              if (e.target.value === 'all') {
                url.searchParams.delete('city');
              } else {
                url.searchParams.set('city', e.target.value);
              }
              window.history.pushState({}, '', url);
            }}
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
            <option value="verified">Verified</option>
            <option value="featured">Featured</option>
            <option value="pending">Pending Review</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {filteredEstablishments.length} establishments
        </span>
        <div className="flex-1" />
        <button className="text-sm text-gray-600 hover:text-gray-900">
          Export CSV
        </button>
        <button className="text-sm text-gray-600 hover:text-gray-900">
          Import
        </button>
      </div>

      {/* Establishments Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input type="checkbox" className="rounded" />
              </th>
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
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEstablishments.map((est) => (
              <EstablishmentRow key={est.id} establishment={est} />
            ))}
          </tbody>
        </table>

        {filteredEstablishments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No establishments found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {filteredEstablishments.length} of {establishments.length}{' '}
          establishments
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
            1
          </span>
          <button
            disabled
            className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function EstablishmentRow({
  establishment,
}: {
  establishment: (typeof GENEVA_ESTABLISHMENTS)[0];
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <input type="checkbox" className="rounded" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <img
            src={establishment.images[0]}
            alt={establishment.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
          <div>
            <p className="font-medium text-gray-900">{establishment.name}</p>
            <p className="text-sm text-gray-500 truncate max-w-[200px]">
              {establishment.address}
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm">
          {categoryIcons[establishment.categorySlug] || '📍'}
          <span className="capitalize">{establishment.categorySlug}</span>
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-gray-900 capitalize">{establishment.citySlug}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">★</span>
          <span className="font-medium">{establishment.rating.toFixed(1)}</span>
          <span className="text-gray-400">({establishment.reviewCount})</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {establishment.isVerified && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Verified
            </span>
          )}
          {establishment.isFeatured && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              Featured
            </span>
          )}
          {!establishment.isVerified && !establishment.isFeatured && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
              Pending
            </span>
          )}
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
                  {establishment.isFeatured ? 'Remove Featured' : 'Mark Featured'}
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  {establishment.isVerified ? 'Remove Verified' : 'Mark Verified'}
                </button>
                <hr className="my-1" />
                <button className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

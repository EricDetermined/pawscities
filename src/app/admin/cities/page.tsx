'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CITIES } from '@/lib/cities-config';

export default function CitiesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cityCounts, setCityCounts] = useState<Record<string, number>>({});
  const cities = Object.values(CITIES);

  useEffect(() => {
    async function fetchCityCounts() {
      try {
        const resp = await fetch('/api/admin/city-stats');
        if (resp.ok) {
          const data = await resp.json();
          setCityCounts(data.counts || {});
        }
      } catch (err) {
        console.error('Failed to fetch city counts:', err);
      }
    }
    fetchCityCounts();
  }, []);

  const filteredCities = cities.filter(
    (city) =>
      city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      city.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cities</h1>
          <p className="text-gray-600">
            Manage cities and their configurations
          </p>
        </div>
        <Link
          href="/admin/cities/new"
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
          Add City
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
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
            placeholder="Search cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Cities Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                City
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Country
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Establishments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Languages
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCities.map((city) => (
              <CityRow key={city.slug} city={city} establishmentCount={cityCounts[city.slug] ?? null} />
            ))}
          </tbody>
        </table>

        {filteredCities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No cities found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {filteredCities.length} of {cities.length} cities
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
          >
            Previous
          </button>
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

function CityRow({ city, establishmentCount }: { city: (typeof CITIES)[keyof typeof CITIES]; establishmentCount: number | null }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const countryFlags: Record<string, string> = {
    Switzerland: '🇨🇭',
    France: '🇫🇷',
    'United Kingdom': '🇬🇧',
    'United States': '🇺🇸',
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <img
            src={city.heroImage}
            alt={city.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
          <div>
            <p className="font-medium text-gray-900">{city.name}</p>
            <p className="text-sm text-gray-500">{city.nameFr}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">{countryFlags[city.country] || '🌍'}</span>
          <span className="text-gray-900">{city.country}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-gray-900">{establishmentCount !== null ? establishmentCount : '...'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            city.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {city.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-1">
          {city.languages.map((lang) => (
            <span
              key={lang}
              className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium uppercase"
            >
              {lang}
            </span>
          ))}
        </div>
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
                  href={`/admin/cities/${city.slug}`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  View Details
                </Link>
                <Link
                  href={`/admin/cities/${city.slug}/edit`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit City
                </Link>
                <Link
                  href={`/admin/establishments?city=${city.slug}`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  View Establishments
                </Link>
                <Link
                  href={`/admin/research/new?city=${city.slug}`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Run Research
                </Link>
                <hr className="my-1" />
                <button
                  className={`block w-full text-left px-4 py-2 text-sm ${
                    city.isActive
                      ? 'text-yellow-700 hover:bg-yellow-50'
                      : 'text-green-700 hover:bg-green-50'
                  }`}
                >
                  {city.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

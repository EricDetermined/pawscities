'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CITIES, getCityConfig } from '@/lib/cities-config';

export default function CityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const city = getCityConfig(slug);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: city?.name || '',
    nameFr: city?.nameFr || '',
    description: city?.description || '',
    descriptionFr: city?.descriptionFr || '',
    isActive: city?.isActive || false,
  });

  if (!city) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">City not found</p>
        <Link href="/admin/cities" className="text-primary-600 hover:underline">
          Back to Cities
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    // TODO: Save to database
    console.log('Saving city:', formData);
    setIsEditing(false);
  };

  const countryFlags: Record<string, string> = {
    Switzerland: '🇨🇭',
    France: '🇫🇷',
    'United Kingdom': '🇬🇧',
    'United States': '🇺🇸',
  };

  // Mock data
  const stats = {
    establishments: slug === 'geneva' ? 24 : 0,
    reviews: 0,
    pageViews: 0,
    searches: 0,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/admin/cities" className="text-gray-500 hover:text-gray-700">
          Cities
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900">{city.name}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <img
            src={city.heroImage}
            alt={city.name}
            className="w-20 h-20 rounded-xl object-cover"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{city.name}</h1>
              <span className="text-2xl">{countryFlags[city.country]}</span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  city.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {city.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-gray-600">{city.country}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border rounded-lg font-medium hover:bg-gray-50 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </button>
              <Link
                href={`/${city.slug}`}
                target="_blank"
                className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View Public Page
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Establishments</p>
          <p className="text-2xl font-bold text-gray-900">{stats.establishments}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Reviews</p>
          <p className="text-2xl font-bold text-gray-900">{stats.reviews}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Page Views</p>
          <p className="text-2xl font-bold text-gray-900">{stats.pageViews}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Searches</p>
          <p className="text-2xl font-bold text-gray-900">{stats.searches}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* City Details */}
        <div className="col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Basic Information
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (English)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <p className="text-gray-900">{city.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (French)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.nameFr}
                      onChange={(e) =>
                        setFormData({ ...formData, nameFr: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <p className="text-gray-900">{city.nameFr}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (English)
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <p className="text-gray-900">{city.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (French)
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.descriptionFr}
                    onChange={(e) =>
                      setFormData({ ...formData, descriptionFr: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <p className="text-gray-900">{city.descriptionFr}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location Info */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Location & Settings
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude
                </label>
                <p className="text-gray-900">{city.latitude}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude
                </label>
                <p className="text-gray-900">{city.longitude}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <p className="text-gray-900">{city.timezone}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <p className="text-gray-900">{city.currency}</p>
              </div>
            </div>
          </div>

          {/* Dog Regulations */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Dog Regulations
            </h2>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className={`px-3 py-1 rounded-full text-sm ${
                    city.dogRegulations.leashRequired
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {city.dogRegulations.leashRequired
                    ? 'Leash Required'
                    : 'Leash Optional'}
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-sm ${
                    city.dogRegulations.offLeashAreas
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {city.dogRegulations.offLeashAreas
                    ? 'Off-leash Areas Available'
                    : 'No Off-leash Areas'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public Transport Policy
                </label>
                <p className="text-gray-900 text-sm">
                  {city.dogRegulations.publicTransport}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>

            <div className="space-y-2">
              <Link
                href={`/admin/establishments?city=${city.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">📍</span>
                <span className="font-medium">View Establishments</span>
              </Link>
              <Link
                href={`/admin/establishments/new?city=${city.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">➕</span>
                <span className="font-medium">Add Establishment</span>
              </Link>
              <Link
                href={`/admin/research/new?city=${city.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">🤖</span>
                <span className="font-medium">Run Research Agent</span>
              </Link>
              <hr className="my-2" />
              <button
                className={`flex items-center gap-3 p-3 rounded-lg w-full transition-colors ${
                  city.isActive
                    ? 'hover:bg-yellow-50 text-yellow-700'
                    : 'hover:bg-green-50 text-green-700'
                }`}
              >
                <span className="text-xl">{city.isActive ? '⏸️' : '▶️'}</span>
                <span className="font-medium">
                  {city.isActive ? 'Deactivate City' : 'Activate City'}
                </span>
              </button>
            </div>
          </div>

          {/* Map Preview */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Location
            </h2>
            <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-gray-500 text-sm">Map preview</p>
            </div>
            <p className="text-sm text-gray-500 mt-2 text-center">
              {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

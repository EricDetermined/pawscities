'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const categories = [
  { value: 'restaurants', label: 'Restaurant', icon: '🍽️' },
  { value: 'cafes', label: 'Cafe', icon: '☕' },
  { value: 'parks', label: 'Park', icon: '🌳' },
  { value: 'hotels', label: 'Hotel', icon: '🏨' },
  { value: 'vets', label: 'Veterinarian', icon: '🏥' },
  { value: 'groomers', label: 'Groomer', icon: '✂️' },
  { value: 'shops', label: 'Pet Shop', icon: '🛍️' },
  { value: 'activities', label: 'Activity', icon: '🎾' },
];

const dogFeatureOptions = [
  { key: 'waterBowl', label: 'Water Bowl', icon: '💧' },
  { key: 'treats', label: 'Dog Treats', icon: '🦴' },
  { key: 'outdoorSeating', label: 'Outdoor Seating', icon: '☀️' },
  { key: 'indoorAllowed', label: 'Dogs Inside', icon: '🏠' },
  { key: 'offLeashArea', label: 'Off-Leash Area', icon: '🐕' },
  { key: 'dogMenu', label: 'Dog Menu', icon: '🍖' },
  { key: 'fenced', label: 'Fenced Area', icon: '🔒' },
  { key: 'shadeAvailable', label: 'Shade Available', icon: '⛱️' },
];

export default function NewEstablishmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
      <NewEstablishmentContent />
    </Suspense>
  );
}

function NewEstablishmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cityParam = searchParams.get('city');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nameFr: '',
    description: '',
    descriptionFr: '',
    citySlug: cityParam || 'geneva',
    categorySlug: 'restaurants',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    website: '',
    priceLevel: 2,
    dogFeatures: {
      waterBowl: false,
      treats: false,
      outdoorSeating: false,
      indoorAllowed: false,
      offLeashArea: false,
      dogMenu: false,
      fenced: false,
      shadeAvailable: false,
    },
    isVerified: false,
    isFeatured: false,
    tier: 'free',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Submit to API
      console.log('Submitting establishment:', formData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      router.push('/admin/establishments');
    } catch (error) {
      console.error('Error creating establishment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFeatureToggle = (key: string) => {
    setFormData({
      ...formData,
      dogFeatures: {
        ...formData.dogFeatures,
        [key]: !formData.dogFeatures[key as keyof typeof formData.dogFeatures],
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/admin/establishments" className="text-gray-500 hover:text-gray-700">
          Establishments
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900">New Establishment</span>
      </nav>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add New Establishment</h1>
        <p className="text-gray-600">
          Add a new dog-friendly place to the database
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Basic Information
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Café du Soleil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name (French)
                </label>
                <input
                  type="text"
                  value={formData.nameFr}
                  onChange={(e) => setFormData({ ...formData, nameFr: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Café du Soleil"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <select
                  value={formData.citySlug}
                  onChange={(e) => setFormData({ ...formData, citySlug: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="geneva">Geneva</option>
                  <option value="paris">Paris</option>
                  <option value="london">London</option>
                  <option value="losangeles">Los Angeles</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.categorySlug}
                  onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (English) *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe what makes this place dog-friendly..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (French)
              </label>
              <textarea
                value={formData.descriptionFr}
                onChange={(e) => setFormData({ ...formData, descriptionFr: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Décrivez ce qui rend cet endroit accueillant pour les chiens..."
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Location
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Place du Petit-Saconnex 6, 1209 Geneva"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude *
                </label>
                <input
                  type="text"
                  required
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., 46.2185"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude *
                </label>
                <input
                  type="text"
                  required
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., 6.1242"
                />
              </div>
            </div>

            <p className="text-sm text-gray-500">
              Tip: Use{' '}
              <a
                href="https://www.google.com/maps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                Google Maps
              </a>{' '}
              to find coordinates. Right-click on the location and copy the coordinates.
            </p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contact Information
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="+41 22 123 45 67"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="contact@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Dog Features */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Dog Features
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {dogFeatureOptions.map((feature) => (
              <button
                key={feature.key}
                type="button"
                onClick={() => handleFeatureToggle(feature.key)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  formData.dogFeatures[feature.key as keyof typeof formData.dogFeatures]
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{feature.icon}</span>
                <span className="text-sm font-medium">{feature.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pricing & Status */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Pricing & Status
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Level
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, priceLevel: level })}
                    className={`px-4 py-2 rounded-lg border font-medium ${
                      formData.priceLevel === level
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {'€'.repeat(level)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Listing Tier
              </label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="free">Free</option>
                <option value="claimed">Claimed</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isVerified}
                onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                className="rounded text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Verified</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                className="rounded text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Featured</span>
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/establishments"
            className="px-6 py-2 border rounded-lg font-medium hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </>
            ) : (
              'Create Establishment'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { TierBadge } from '@/components/business/TierBadge';

interface Establishment {
  id: string;
  name: string;
  description: string;
  phone?: string;
  website?: string;
  dogFeatures?: Record<string, any>;
  hours?: Record<string, any>;
}

interface Subscription {
  tier: 'free' | 'premium';
}

const DOG_FEATURES = [
  { key: 'waterBowl', label: 'Water Bowl', icon: '💧' },
  { key: 'treats', label: 'Dog Treats Available', icon: '🍖' },
  { key: 'outdoorSeating', label: 'Outdoor Seating', icon: '🪑' },
  { key: 'indoorAllowed', label: 'Dogs Allowed Indoors', icon: '🏠' },
  { key: 'offLeashArea', label: 'Off-Leash Area', icon: '🆓' },
  { key: 'dogMenu', label: 'Dog Menu Items', icon: '🍽️' },
  { key: 'fenced', label: 'Fully Fenced', icon: '🚧' },
  { key: 'shadeAvailable', label: 'Shade Available', icon: '☀️' },
];

export default function EditListing() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    phone: '',
    website: '',
    dogFeatures: {} as Record<string, boolean>,
    openingHours: '',
  });

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const [listingRes, dashRes] = await Promise.all([
          fetch('/api/business/listing'),
          fetch('/api/business/dashboard'),
        ]);

        if (!listingRes.ok || !dashRes.ok) {
          throw new Error('Failed to load listing');
        }

        const listing = await listingRes.json();
        const dash = await dashRes.json();

        setEstablishment(listing.establishment);
        setSubscription(dash.subscription);

        setFormData({
          description: listing.establishment.description || '',
          phone: listing.establishment.phone || '',
          website: listing.establishment.website || '',
          dogFeatures: listing.establishment.dogFeatures || {},
          openingHours: JSON.stringify(listing.establishment.hours) || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/business/listing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description,
          phone: formData.phone,
          website: formData.website,
          dogFeatures: formData.dogFeatures,
          openingHours: formData.openingHours,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const result = await response.json();
      setEstablishment(result.establishment);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!establishment || !subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Failed to load listing
      </div>
    );
  }

  const tier = subscription.tier;
  const premiumFields = ['website', 'openingHours'];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {establishment.name}
          </h1>
          <p className="text-gray-600">Edit your business listing details</p>
        </div>
        <TierBadge tier={tier} />
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          ✓ Changes saved successfully
        </div>
      )}

      <div className="space-y-6">
        {/* Description */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Tell customers about your business and why they should visit with their dogs..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-32"
          />
          <p className="text-xs text-gray-500 mt-2">
            {formData.description.length} / 500 characters
          </p>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contact Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Website
                </label>
                {tier === 'free' && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                    Premium only
                  </span>
                )}
              </div>
              <input
                type="url"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://example.com"
                disabled={tier === 'free'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Dog Features */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Dog-Friendly Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DOG_FEATURES.map((feature) => (
              <label
                key={feature.key}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-orange-500 cursor-pointer hover:bg-orange-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={formData.dogFeatures[feature.key] || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dogFeatures: {
                        ...formData.dogFeatures,
                        [feature.key]: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-lg">{feature.icon}</span>
                <span className="text-sm font-medium text-gray-900">
                  {feature.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Opening Hours */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Opening Hours
            </h2>
            {tier === 'free' && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                Premium only
              </span>
            )}
          </div>
          <textarea
            value={formData.openingHours}
            onChange={(e) =>
              setFormData({ ...formData, openingHours: e.target.value })
            }
            placeholder="Mon-Fri: 9am - 6pm&#10;Sat-Sun: 10am - 5pm"
            disabled={tier === 'free'}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-24 disabled:bg-gray-50 disabled:text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-2">
            Enter your opening hours in a simple format (e.g., Mon-Fri: 9am - 6pm)
          </p>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TierBadge } from '@/components/business/TierBadge';
import { UpgradePrompt } from '@/components/business/UpgradePrompt';

interface DashboardData {
  status: string;
  message?: string;
  establishment?: {
    id: string;
    name: string;
    address: string;
    phone?: string;
    website?: string;
    image?: string;
  };
  analytics?: {
    viewsThisMonth: number;
    totalReviews: number;
    avgRating: number;
  };
  subscription?: {
    tier: 'free' | 'premium';
    isPremium: boolean;
  };
}

export default function BusinessDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/business/dashboard');
        if (!response.ok) {
          throw new Error('Failed to load dashboard');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-medium">Error loading dashboard</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (data?.status === 'pending') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">⏳</div>
        <h2 className="text-lg font-semibold text-yellow-900 mb-2">
          {data.message || 'Your claim is pending review'}
        </h2>
        <p className="text-yellow-700 text-sm mb-4">
          We're reviewing your business claim. This usually takes 1-2 business days.
        </p>
        <p className="text-yellow-600 text-sm">
          You'll receive an email notification when your claim is approved.
        </p>
      </div>
    );
  }

  if (!data?.establishment) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        No establishment found
      </div>
    );
  }

  const tier = data.subscription?.tier || 'free';

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            {data.establishment.name}
          </h1>
          <TierBadge tier={tier} />
        </div>
        <p className="text-gray-600">{data.establishment.address}</p>
      </div>

      {/* Upgrade Banner for Free Tier */}
      {tier === 'free' && <UpgradePrompt />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="text-3xl mb-2">👀</div>
          <p className="text-gray-600 text-sm mb-1">Views This Month</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.analytics?.viewsThisMonth || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="text-3xl mb-2">⭐</div>
          <p className="text-gray-600 text-sm mb-1">Total Reviews</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.analytics?.totalReviews || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-gray-600 text-sm mb-1">Average Rating</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.analytics?.avgRating?.toFixed(1) || 'N/A'}
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="text-3xl mb-2">📞</div>
          <p className="text-gray-600 text-sm mb-1">Contact Info</p>
          <p className="text-sm text-gray-900 font-medium">
            {data.establishment.phone || 'Not set'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/business/listing"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-colors"
          >
            <span className="text-2xl">✏️</span>
            <div>
              <p className="font-medium text-gray-900">Edit Listing</p>
              <p className="text-xs text-gray-600">
                Update your description and details
              </p>
            </div>
          </Link>

          <Link
            href="/business/reviews"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-colors"
          >
            <span className="text-2xl">💬</span>
            <div>
              <p className="font-medium text-gray-900">View Reviews</p>
              <p className="text-xs text-gray-600">
                {tier === 'premium'
                  ? 'Respond to customer reviews'
                  : 'See what customers say'}
              </p>
            </div>
          </Link>

          <Link
            href="/business/analytics"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-colors"
          >
            <span className="text-2xl">📈</span>
            <div>
              <p className="font-medium text-gray-900">Analytics</p>
              <p className="text-xs text-gray-600">
                {tier === 'premium'
                  ? 'View detailed insights'
                  : 'Upgrade to unlock'}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Subscription Info */}
      {data.subscription && (
        <div className="mt-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-6 border border-orange-200">
          <h3 className="font-semibold text-gray-900 mb-2">
            Subscription Status
          </h3>
          <p className="text-gray-700 mb-3">
            {tier === 'premium'
              ? 'Your account has access to all Premium features.'
              : 'You are using the Free plan. Upgrade to unlock more features.'}
          </p>
          {tier === 'free' && (
            <Link
              href="/business/upgrade"
              className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              View Pricing Plans
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FeatureGate, TierBadge, hasFeatureAccess } from '@/components/business/FeatureGate';
import type { SubscriptionTier } from '@/components/business/FeatureGate';

interface ClaimedBusiness {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  category: string;
  subscriptionTier: SubscriptionTier;
  stats: {
    views: number;
    viewsTrend: number;
    checkins: number;
    checkinsTrend: number;
    reviews: number;
    avgRating: number;
    favorites: number;
  };
}

export default function BusinessDashboard() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<ClaimedBusiness[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/business/claimed')
      .then(res => {
        if (res.status === 401) { router.push('/auth/login?redirect=/business'); return null; }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setBusinesses(data.businesses || []);
        if (data.businesses?.length > 0) setSelectedBusiness(data.businesses[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Businesses Yet</h2>
        <p className="text-gray-600 mb-6">Claim your establishment to start managing your listing on Paw Cities.</p>
        <Link href="/business/claim" className="inline-flex px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
          Claim Your Business
        </Link>
      </div>
    );
  }

  const biz = businesses.find(b => b.id === selectedBusiness) || businesses[0];
  const tier = (biz.subscriptionTier || 'FREE') as SubscriptionTier;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{biz.name}</h1>
            <TierBadge tier={tier} />
          </div>
          <p className="text-sm text-gray-500">{biz.address} &middot; {biz.city} &middot; {biz.category}</p>
        </div>
        <div className="flex items-center gap-3">
          {businesses.length > 1 && (
            <select
              value={selectedBusiness || ''}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {tier === 'FREE' && (
            <Link href="/business/upgrade" className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors">
              Upgrade
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid - Always visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500 mb-1">Profile Views</p>
          <p className="text-2xl font-bold text-gray-900">{biz.stats.views.toLocaleString()}</p>
          <p className={`text-xs mt-1 ${biz.stats.viewsTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {biz.stats.viewsTrend >= 0 ? '+' : ''}{biz.stats.viewsTrend}% this week
          </p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500 mb-1">Check-ins</p>
          <p className="text-2xl font-bold text-gray-900">{biz.stats.checkins.toLocaleString()}</p>
          <p className={`text-xs mt-1 ${biz.stats.checkinsTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {biz.stats.checkinsTrend >= 0 ? '+' : ''}{biz.stats.checkinsTrend}% this week
          </p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500 mb-1">Reviews</p>
          <p className="text-2xl font-bold text-gray-900">{biz.stats.reviews}</p>
          <p className="text-xs mt-1 text-gray-500">Avg: {biz.stats.avgRating.toFixed(1)} / 5</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500 mb-1">Favorites</p>
          <p className="text-2xl font-bold text-gray-900">{biz.stats.favorites}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions - Always visible */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/business/listing`} className="flex items-center gap-3 p-3 rounded-lg border hover:border-orange-300 hover:bg-orange-50/50 transition-colors">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Edit Listing</span>
              </Link>

              {/* Respond to Reviews - BRONZE+ */}
              {hasFeatureAccess(tier, 'BRONZE') ? (
                <Link href={`/business/reviews/${biz.id}`} className="flex items-center gap-3 p-3 rounded-lg border hover:border-orange-300 hover:bg-orange-50/50 transition-colors">
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4.5 h-4.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Respond to Reviews</span>
                </Link>
              ) : (
                <Link href="/business/upgrade" className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 hover:border-orange-300 transition-colors relative">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-400">Respond to Reviews</span>
                    <span className="block text-xs text-orange-500">Bronze+</span>
                  </div>
                </Link>
              )}

              {/* Create Event - SILVER+ */}
              {hasFeatureAccess(tier, 'SILVER') ? (
                <Link href="/business/events" className="flex items-center gap-3 p-3 rounded-lg border hover:border-orange-300 hover:bg-orange-50/50 transition-colors">
                  <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4.5 h-4.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Create Event</span>
                </Link>
              ) : (
                <Link href="/business/upgrade" className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 hover:border-orange-300 transition-colors">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-400">Create Event</span>
                    <span className="block text-xs text-orange-500">Silver+</span>
                  </div>
                </Link>
              )}

              {/* Special Offers - BRONZE+ */}
              {hasFeatureAccess(tier, 'BRONZE') ? (
                <Link href="/business/events" className="flex items-center gap-3 p-3 rounded-lg border hover:border-orange-300 hover:bg-orange-50/50 transition-colors">
                  <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4.5 h-4.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Special Offers</span>
                </Link>
              ) : (
                <Link href="/business/upgrade" className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 hover:border-orange-300 transition-colors">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-400">Special Offers</span>
                    <span className="block text-xs text-orange-500">Bronze+</span>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Advanced Analytics - Gated for SILVER+ */}
          <FeatureGate currentTier={tier} requiredTier="SILVER" featureName="Advanced Analytics">
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Performance Analytics</h2>
                <Link href={`/business/analytics/${biz.id}`} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                  View Full Report &rarr;
                </Link>
              </div>
              <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                Analytics charts load here
              </div>
            </div>
          </FeatureGate>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 py-2 border-b border-gray-50">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">New check-in from a visitor with a Golden Retriever</p>
                  <p className="text-xs text-gray-400">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2 border-b border-gray-50">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">New 5-star review posted</p>
                  <p className="text-xs text-gray-400">Yesterday</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Someone added your business to favorites</p>
                  <p className="text-xs text-gray-400">2 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upgrade Card - Only for FREE tier */}
          {tier === 'FREE' && (
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-6 text-white">
              <h3 className="font-bold text-lg mb-2">Unlock Premium Features</h3>
              <p className="text-sm text-orange-100 mb-4">
                Respond to reviews, create events, and get advanced analytics to grow your business.
              </p>
              <ul className="space-y-2 mb-5 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Respond to all reviews
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Enhanced listing badge
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Priority in local search
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Weekly performance reports
                </li>
              </ul>
              <Link
                href="/business/upgrade"
                className="block w-full text-center px-4 py-2.5 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                View Plans from $29/mo
              </Link>
            </div>
          )}

          {/* Listing Completeness */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Listing Completeness</h3>
            <div className="relative w-full h-2 bg-gray-100 rounded-full mb-3">
              <div className="absolute h-2 bg-orange-500 rounded-full" style={{ width: '60%' }} />
            </div>
            <p className="text-sm text-gray-500 mb-3">60% complete</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-green-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Business name & address
              </li>
              <li className="flex items-center gap-2 text-green-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Category selected
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Add business hours
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Upload photos
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Add description
              </li>
            </ul>
            <Link href="/business/listing" className="mt-4 inline-flex text-sm text-orange-600 hover:text-orange-700 font-medium">
              Complete your listing &rarr;
            </Link>
          </div>

          {/* Your Plan */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Your Plan</h3>
            <div className="flex items-center gap-2 mb-3">
              <TierBadge tier={tier} size="md" />
              {tier !== 'GOLD' && (
                <Link href="/business/upgrade" className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                  Upgrade
                </Link>
              )}
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              {tier === 'FREE' && <p>Basic listing with limited features</p>}
              {tier === 'BRONZE' && <p>Enhanced listing with review management</p>}
              {tier === 'SILVER' && <p>Full analytics, events & city guides</p>}
              {tier === 'GOLD' && <p>Premium with dedicated account manager</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TierBadge } from '@/components/business/TierBadge';
import { PremiumFeature } from '@/components/business/PremiumFeature';

interface AnalyticsData {
  summary: {
    totalViews: number;
    totalClicks: number;
    avgViewsPerDay: number;
  };
  clicks: {
    phone: number;
    website: number;
    directions: number;
  };
  daily: Array<{
    date: string;
    views: number;
    clicks: number;
  }>;
  period: {
    start: string;
    end: string;
  };
}

interface Subscription {
  tier: 'free' | 'premium';
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [analyticsRes, dashRes] = await Promise.all([
          fetch('/api/business/analytics'),
          fetch('/api/business/dashboard'),
        ]);

        if (!analyticsRes.ok || !dashRes.ok) {
          throw new Error('Failed to load analytics');
        }

        const analyticsData = await analyticsRes.json();
        const dashData = await dashRes.json();

        setAnalytics(analyticsData);
        setSubscription(dashData.subscription);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Failed to load analytics
      </div>
    );
  }

  const tier = subscription.tier;

  if (tier === 'free') {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
            <p className="text-gray-600">View insights about your business</p>
          </div>
          <TierBadge tier={tier} />
        </div>

        <PremiumFeature tier="free" feature="Analytics Dashboard">
          <div className="h-96 bg-gray-50 rounded-lg"></div>
        </PremiumFeature>

        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unlock Advanced Analytics
          </h3>
          <p className="text-gray-700 mb-4">
            Upgrade to Premium to see detailed analytics about your business
            performance, including:
          </p>
          <ul className="text-left inline-block space-y-2 mb-6 text-gray-700">
            <li className="flex items-center gap-2">
              <span>✓</span> 30-day view and click trends
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Phone, website, and direction clicks breakdown
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Daily performance charts
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Identify peak hours and days
            </li>
          </ul>
          <Link
            href="/business/upgrade"
            className="inline-block px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
          >
            Upgrade to Premium
          </Link>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error || 'Failed to load analytics'}
      </div>
    );
  }

  const maxViewsPerDay = Math.max(
    ...analytics.daily.map((d) => d.views),
    10
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">
            Last 30 days ({analytics.period.start} to {analytics.period.end})
          </p>
        </div>
        <TierBadge tier={tier} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Total Views</p>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.summary.totalViews}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            ~{analytics.summary.avgViewsPerDay} per day
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Total Clicks</p>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.summary.totalClicks}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {analytics.summary.totalViews > 0
              ? (
                  (analytics.summary.totalClicks /
                    analytics.summary.totalViews) *
                  100
                ).toFixed(1)
              : 0}
            % click rate
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Engagement</p>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.summary.totalViews > 0
              ? ((analytics.summary.totalClicks /
                  analytics.summary.totalViews) *
                  100).toFixed(0)
              : 0}
            %
          </p>
          <p className="text-xs text-gray-500 mt-2">Click-through rate</p>
        </div>
      </div>

      {/* Clicks Breakdown */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Interaction Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
            <div className="text-3xl">📞</div>
            <div>
              <p className="text-gray-600 text-sm">Phone Clicks</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.clicks.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
            <div className="text-3xl">🌐</div>
            <div>
              <p className="text-gray-600 text-sm">Website Clicks</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.clicks.website}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
            <div className="text-3xl">🗺️</div>
            <div>
              <p className="text-gray-600 text-sm">Direction Clicks</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.clicks.directions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Chart */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Views Trend
        </h2>
        <div className="space-y-4">
          {/* Mini Bar Chart */}
          <div className="h-64 flex items-end gap-1 px-2">
            {analytics.daily.map((day) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full bg-orange-500 rounded-t"
                  style={{
                    height: `${(day.views / maxViewsPerDay) * 240}px`,
                    minHeight: day.views > 0 ? '4px' : '1px',
                  }}
                  title={`${day.date}: ${day.views} views`}
                />
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 text-center">
            Each bar represents one day of views
          </div>
        </div>
      </div>

      {/* Daily Details Table */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Date
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Views
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Clicks
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  CTR
                </th>
              </tr>
            </thead>
            <tbody>
              {analytics.daily.map((day) => (
                <tr key={day.date} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {day.views}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {day.clicks}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {day.views > 0
                      ? ((day.clicks / day.views) * 100).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TierBadge } from '@/components/business/TierBadge';
import { PremiumFeature } from '@/components/business/PremiumFeature';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

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

  // Prepare chart data with formatted labels
  const chartData = analytics.daily.map((d) => ({
    ...d,
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  // Click breakdown data for bar chart
  const clickBreakdownData = [
    { name: 'Phone', value: analytics.clicks.phone, fill: '#3b82f6' },
    { name: 'Website', value: analytics.clicks.website, fill: '#10b981' },
    { name: 'Directions', value: analytics.clicks.directions, fill: '#f97316' },
  ];

  const clickRate = analytics.summary.totalViews > 0
    ? ((analytics.summary.totalClicks / analytics.summary.totalViews) * 100).toFixed(1)
    : '0';

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
            {analytics.summary.totalViews.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            ~{analytics.summary.avgViewsPerDay} per day
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Total Clicks</p>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.summary.totalClicks.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {clickRate}% click rate
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Engagement</p>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.summary.totalViews > 0
              ? ((analytics.summary.totalClicks / analytics.summary.totalViews) * 100).toFixed(0)
              : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-2">Click-through rate</p>
        </div>
      </div>

      {/* Clicks Breakdown */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Interaction Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid grid-cols-1 gap-4">
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
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clickBreakdownData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="value" name="Clicks" radius={[0, 4, 4, 0]}>
                  {clickBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Views & Clicks Trend Chart */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Views & Clicks Trend
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '13px' }} />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#viewsGrad)"
              name="Views"
            />
            <Area
              type="monotone"
              dataKey="clicks"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#clicksGrad)"
              name="Clicks"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Details Table */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">Views</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">Clicks</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">CTR</th>
              </tr>
            </thead>
            <tbody>
              {analytics.daily.slice().reverse().slice(0, 14).map((day) => (
                <tr key={day.date} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{day.views}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{day.clicks}</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {day.views > 0 ? ((day.clicks / day.views) * 100).toFixed(1) : 0}%
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

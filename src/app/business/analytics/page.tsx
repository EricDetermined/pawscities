'use client';

import { useState, useEffect, useCallback } from 'react';
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
    totalClicks: number;
    totalSearchAppearances: number;
    avgClicksPerDay: number;
    clickThroughRate: number;
  };
  tier: string;
  clicks?: {
    phone: number;
    website: number;
    directions: number;
  };
  daily?: Array<{
    date: string;
    views: number;
    clicks: number;
  }>;
  period: {
    start: string;
    end: string;
    days: number;
  };
  recentActivity?: Array<{
    type: string;
    createdAt: string;
    userId: string | null;
  }>;
  uniqueVisitors?: number;
  peakDay?: {
    date: string;
    views: number;
  };
}

// Date range presets
const DATE_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
];

function formatEventType(type: string): string {
  switch (type) {
    case 'PHONE': return 'Phone call';
    case 'WEBSITE': return 'Website visit';
    case 'DIRECTIONS': return 'Get directions';
    case 'SEARCH_APPEARANCE': return 'Appeared in search';
    default: return type.replace(/_/g, ' ').toLowerCase();
  }
}

function formatEventIcon(type: string): string {
  switch (type) {
    case 'PHONE': return '\u{1F4DE}';
    case 'WEBSITE': return '\u{1F310}';
    case 'DIRECTIONS': return '\u{1F5FA}';
    case 'SEARCH_APPEARANCE': return '\u{1F50D}';
    default: return '\u{1F4CA}';
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ days: 30, start: '', end: '' });
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = useCallback(async (start?: string, end?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);

      const url = `/api/business/analytics${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to load analytics');
      }

      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handlePresetChange = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    setDateRange({ days, start: startStr, end: endStr });
    fetchAnalytics(startStr, endStr);
  };

  const handleCustomRange = (start: string, end: string) => {
    setDateRange({ days: 0, start, end });
    fetchAnalytics(start, end);
  };

  const handleExport = async (format: 'daily' | 'events') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('start', dateRange.start);
      if (dateRange.end) params.set('end', dateRange.end);
      params.set('format', format);

      const res = await fetch(`/api/business/analytics/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Export failed');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'analytics.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    );
  }

  const tier = analytics?.tier || 'free';
  const isPremium = tier === 'premium';

  // ===========================
  // FREE TIER: Aggregates only
  // ===========================
  if (!isPremium) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
            <p className="text-gray-600">Your business at a glance — last 30 days</p>
          </div>
          <TierBadge tier="free" />
        </div>

        {/* Basic Stats - 3 aggregate cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <p className="text-gray-600 text-sm mb-1">Search Appearances</p>
              <p className="text-3xl font-bold text-gray-900">
                {(analytics.summary.totalSearchAppearances ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Times your listing appeared in results
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <p className="text-gray-600 text-sm mb-1">Total Clicks</p>
              <p className="text-3xl font-bold text-gray-900">
                {(analytics.summary.totalClicks ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Phone, website, and direction clicks
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <p className="text-gray-600 text-sm mb-1">Click-through Rate</p>
              <p className="text-3xl font-bold text-gray-900">
                {analytics.summary.clickThroughRate ?? 0}%
              </p>
              <p className="text-xs text-gray-500 mt-2">
                % of viewers who clicked your listing
              </p>
            </div>
          </div>
        )}

        {/* Premium Upsell */}
        <PremiumFeature tier="free" feature="Detailed Analytics">
          <div className="h-64 bg-gray-50 rounded-lg"></div>
        </PremiumFeature>

        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unlock Premium Analytics
          </h3>
          <p className="text-gray-700 mb-4">
            Get deeper insights into how customers find and interact with your business:
          </p>
          <ul className="text-left inline-block space-y-2 mb-6 text-gray-700">
            <li className="flex items-center gap-2">
              <span className="text-green-600 font-bold">&#10003;</span>
              Custom date ranges (7, 30, 60, 90 days or custom)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600 font-bold">&#10003;</span>
              Click breakdown: phone, website, and directions
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600 font-bold">&#10003;</span>
              Daily trend charts with views and clicks
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600 font-bold">&#10003;</span>
              Recent activity feed with interaction details
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600 font-bold">&#10003;</span>
              Export to CSV for your own reporting
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600 font-bold">&#10003;</span>
              Unique visitor count and peak day insights
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

  // ===========================
  // PREMIUM TIER: Full dashboard
  // ===========================
  if (!analytics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error || 'Failed to load analytics'}
      </div>
    );
  }

  const chartData = (analytics.daily || []).map((d) => ({
    ...d,
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  const clickBreakdownData = analytics.clicks
    ? [
        { name: 'Phone', value: analytics.clicks.phone, fill: '#3b82f6' },
        { name: 'Website', value: analytics.clicks.website, fill: '#10b981' },
        { name: 'Directions', value: analytics.clicks.directions, fill: '#f97316' },
      ]
    : [];

  return (
    <div>
      {/* Header with date range controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Analytics</h1>
          <p className="text-gray-600 text-sm">
            {analytics.period.start} to {analytics.period.end} ({analytics.period.days} days)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TierBadge tier="premium" />
        </div>
      </div>

      {/* Date range controls */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Period:</span>
            <div className="flex gap-1">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => handlePresetChange(preset.days)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    dateRange.days === preset.days
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">or</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                const newStart = e.target.value;
                if (newStart && dateRange.end) {
                  handleCustomRange(newStart, dateRange.end);
                }
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                const newEnd = e.target.value;
                if (dateRange.start && newEnd) {
                  handleCustomRange(dateRange.start, newEnd);
                }
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          {/* Export buttons */}
          <div className="flex items-center gap-2 md:ml-auto">
            <button
              onClick={() => handleExport('daily')}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? 'Exporting...' : 'Export Daily CSV'}
            </button>
            <button
              onClick={() => handleExport('events')}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? 'Exporting...' : 'Export Events CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats - 5 cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-gray-600 text-xs mb-1">Search Appearances</p>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.summary.totalSearchAppearances.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-gray-600 text-xs mb-1">Total Clicks</p>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.summary.totalClicks.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-gray-600 text-xs mb-1">Click-through Rate</p>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.summary.clickThroughRate}%
          </p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-gray-600 text-xs mb-1">Unique Visitors</p>
          <p className="text-2xl font-bold text-gray-900">
            {(analytics.uniqueVisitors ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-gray-600 text-xs mb-1">Peak Day</p>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.peakDay?.views ?? 0}
          </p>
          <p className="text-xs text-gray-500">
            {analytics.peakDay?.date
              ? new Date(analytics.peakDay.date + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Two-column: Click breakdown + Trend chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Click Breakdown */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Click Breakdown
          </h2>
          <div className="space-y-4 mb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
              <div className="flex items-center gap-3">
                <span className="text-xl">{'\u{1F4DE}'}</span>
                <span className="text-sm font-medium text-gray-700">Phone</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {analytics.clicks?.phone ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
              <div className="flex items-center gap-3">
                <span className="text-xl">{'\u{1F310}'}</span>
                <span className="text-sm font-medium text-gray-700">Website</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {analytics.clicks?.website ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50">
              <div className="flex items-center gap-3">
                <span className="text-xl">{'\u{1F5FA}'}</span>
                <span className="text-sm font-medium text-gray-700">Directions</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {analytics.clicks?.directions ?? 0}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={clickBreakdownData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" width={70} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
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

        {/* Views & Clicks Trend */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Views & Clicks Trend
          </h2>
          <ResponsiveContainer width="100%" height={280}>
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
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
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
      </div>

      {/* Two-column: Recent Activity + Daily Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          {analytics.recentActivity && analytics.recentActivity.length > 0 ? (
            <div className="space-y-0 max-h-96 overflow-y-auto">
              {analytics.recentActivity.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-lg flex-shrink-0">
                    {formatEventIcon(activity.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {formatEventType(activity.type)}
                    </p>
                    {activity.userId && (
                      <p className="text-xs text-gray-500 truncate">
                        Visitor #{activity.userId.slice(0, 8)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {timeAgo(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recent activity in this period.</p>
          )}
        </div>

        {/* Daily Details Table */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Details</h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Views</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Clicks</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">CTR</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.daily || []).slice().reverse().map((day) => (
                  <tr key={day.date} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">
                      {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">{day.views}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{day.clicks}</td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {day.views > 0 ? ((day.clicks / day.views) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

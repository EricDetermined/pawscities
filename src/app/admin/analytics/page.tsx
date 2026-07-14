'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopPost {
  id: string;
  headline: string;
  city: string;
  likes: number;
  comments_count: number;
  engagement_score: number;
  created_at: string;
}

interface AnalyticsData {
  period: { start: string; end: string };
  social: {
    totalPosted: number;
    avgLikes: number;
    avgComments: number;
    avgEngagement: number;
    postsByDay: Array<{ date: string; count: number; avgEngagement: number }>;
    postsByCity: Record<string, number>;
    postsByType: Record<string, number>;
    topPosts: TopPost[];
    dailyEngagement: Array<{ date: string; avgLikes: number; avgComments: number }>;
  };
  pipeline: {
    creativeQueue: {
      queued: number;
      posted: number;
      failed: number;
      needsReview: number;
      total: number;
    };
    queueByCity: Record<string, number>;
    events: {
      approved: number;
      pending: number;
      rejected: number;
      newThisWeek: number;
      newLastWeek: number;
    };
  };
  community: {
    totalComments: number;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
    replyRate: number;
    opportunities: { total: number; new: number; replied: number; skipped: number };
  };
  insights: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIE_COLORS = [
  '#f97316',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#06b6d4',
  '#ef4444',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function titleCase(str: string): string {
  return str
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatPeriodBadge(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(s)} - ${fmt(e)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  warning,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  color: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-6 ${
        warning ? 'border-red-300 ring-1 ring-red-200' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div
          className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white text-xl`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${warning ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`text-sm ${warning ? 'text-red-500' : 'text-gray-500'}`}>{subtitle}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Growth Intelligence</h1>
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
            <div className="h-64 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Growth Intelligence</h1>
        <p className="text-gray-600">
          Social performance, engagement trends, and content pipeline health
        </p>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center justify-between">
        <p className="text-red-800">{message}</p>
        <button
          onClick={onRetry}
          className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for recharts
// ---------------------------------------------------------------------------

const chartTooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '13px',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const json: AnalyticsData = await response.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // -- Loading -----------------------------------------------------------------
  if (loading) {
    return <LoadingSkeleton />;
  }

  // -- Error -------------------------------------------------------------------
  if (error || !data) {
    return <ErrorState message={error || 'Failed to load analytics'} onRetry={fetchAnalytics} />;
  }

  // -- Derived data ------------------------------------------------------------
  const { social, pipeline, community, insights, period } = data;

  // Posting cadence: last 14 entries
  const cadenceData = social.postsByDay.slice(-14).map((d) => ({
    ...d,
    label: formatShortDate(d.date),
  }));

  // Engagement trend
  const engagementData = social.dailyEngagement.map((d) => ({
    ...d,
    label: formatShortDate(d.date),
  }));

  // Posts by city for horizontal bar chart
  const cityData = Object.entries(social.postsByCity)
    .map(([city, count]) => ({ city: titleCase(city), count }))
    .sort((a, b) => b.count - a.count);

  // Posts by type for pie chart
  const typeData = Object.entries(social.postsByType)
    .map(([name, value]) => ({ name: titleCase(name), value }))
    .sort((a, b) => b.value - a.value);

  // Creative queue warning
  const queueWarning = pipeline.creativeQueue.queued < 5;

  // Events week-over-week
  const eventsWoW =
    pipeline.events.newLastWeek > 0
      ? ((pipeline.events.newThisWeek - pipeline.events.newLastWeek) /
          pipeline.events.newLastWeek) *
        100
      : 0;

  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Intelligence</h1>
          <p className="text-gray-600">
            Social performance, engagement trends, and content pipeline health
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 whitespace-nowrap">
          {formatPeriodBadge(period.start, period.end)}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. AI Insights Banner                                              */}
      {/* ------------------------------------------------------------------ */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <span className="text-xl">&#x1F4A1;</span> AI Insights
          </h2>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-0.5 flex-shrink-0">&#x1F4A1;</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. KPI Cards                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Posts Published"
          value={social.totalPosted.toLocaleString()}
          subtitle="last 30 days"
          icon="&#x1F4DD;"
          color="bg-orange-500"
        />
        <StatCard
          title="Avg Engagement Score"
          value={social.avgEngagement.toFixed(1)}
          subtitle={`${social.avgLikes.toFixed(0)} likes / ${social.avgComments.toFixed(0)} comments avg`}
          icon="&#x1F525;"
          color="bg-blue-500"
        />
        <StatCard
          title="Creative Queue"
          value={pipeline.creativeQueue.queued.toLocaleString()}
          subtitle={queueWarning ? 'Low queue - add more content' : 'items ready to post'}
          icon="&#x1F4CB;"
          color={queueWarning ? 'bg-red-500' : 'bg-green-500'}
          warning={queueWarning}
        />
        <StatCard
          title="Community Reply Rate"
          value={`${(community.replyRate * 100).toFixed(0)}%`}
          subtitle={`${community.totalComments.toLocaleString()} total comments`}
          icon="&#x1F4AC;"
          color="bg-purple-500"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Charts Row 1: Posting Cadence + Engagement Trend                */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posting Cadence */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Posting Cadence</h2>
          {cadenceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cadenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar
                  dataKey="count"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  name="Posts"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No posting data available
            </div>
          )}
        </div>

        {/* Engagement Trend */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Trend</h2>
          {engagementData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={engagementData}>
                <defs>
                  <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="commentsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="avgLikes"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#likesGradient)"
                  name="Avg Likes"
                />
                <Area
                  type="monotone"
                  dataKey="avgComments"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#commentsGradient)"
                  name="Avg Comments"
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No engagement data available
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Charts Row 2: Posts by City + Content Type Mix                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posts by City - Horizontal Bar Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Posts by City</h2>
          {cityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(280, cityData.length * 40)}>
              <BarChart data={cityData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="city"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  width={100}
                />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Posts" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No city data available
            </div>
          )}
        </div>

        {/* Content Type Mix - Pie Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Type Mix</h2>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {typeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No content type data available
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Pipeline Health                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Creative Queue */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Creative Queue</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">
                {pipeline.creativeQueue.queued.toLocaleString()}
              </p>
              <p className="text-sm text-orange-700">Queued</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {pipeline.creativeQueue.posted.toLocaleString()}
              </p>
              <p className="text-sm text-green-700">Posted</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">
                {pipeline.creativeQueue.failed.toLocaleString()}
              </p>
              <p className="text-sm text-red-700">Failed</p>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {pipeline.creativeQueue.needsReview.toLocaleString()}
              </p>
              <p className="text-sm text-yellow-700">Needs Review</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total in pipeline</span>
              <span className="font-semibold text-gray-900">
                {pipeline.creativeQueue.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Events Pipeline */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Events Pipeline</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {pipeline.events.approved.toLocaleString()}
              </p>
              <p className="text-sm text-green-700">Approved</p>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {pipeline.events.pending.toLocaleString()}
              </p>
              <p className="text-sm text-yellow-700">Pending</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">
                {pipeline.events.rejected.toLocaleString()}
              </p>
              <p className="text-sm text-red-700">Rejected</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">New this week</span>
              <span className="font-semibold text-gray-900">
                {pipeline.events.newThisWeek.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">New last week</span>
              <span className="font-semibold text-gray-900">
                {pipeline.events.newLastWeek.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Week-over-week</span>
              <span
                className={`font-semibold ${
                  eventsWoW > 0
                    ? 'text-green-600'
                    : eventsWoW < 0
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              >
                {eventsWoW > 0 ? '+' : ''}
                {eventsWoW.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Top Performing Posts                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Posts</h2>
        {social.topPosts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Headline</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">City</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Likes</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Comments</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">
                    Engagement
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {social.topPosts.slice(0, 5).map((post, index) => (
                  <tr
                    key={post.id}
                    className={`border-b border-gray-100 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-orange-50 transition-colors`}
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 max-w-xs truncate">
                      {post.headline}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{titleCase(post.city)}</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-medium">
                      {post.likes.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 font-medium">
                      {post.comments_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                        {post.engagement_score.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      {formatShortDate(post.created_at.split('T')[0])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No top posts data available</p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 8. Community Metrics                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Community Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sentiment Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Comment Sentiment</h3>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-100 text-green-800 font-medium text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                Positive: {community.sentimentBreakdown.positive.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                Neutral: {community.sentimentBreakdown.neutral.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-100 text-red-800 font-medium text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Negative: {community.sentimentBreakdown.negative.toLocaleString()}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {community.totalComments.toLocaleString()} total comments analyzed
            </p>
          </div>

          {/* Opportunities */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Engagement Opportunities
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                <p className="text-xl font-bold text-blue-600">
                  {community.opportunities.new.toLocaleString()}
                </p>
                <p className="text-xs text-blue-700">New</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                <p className="text-xl font-bold text-green-600">
                  {community.opportunities.replied.toLocaleString()}
                </p>
                <p className="text-xs text-green-700">Replied</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
                <p className="text-xl font-bold text-gray-600">
                  {community.opportunities.skipped.toLocaleString()}
                </p>
                <p className="text-xs text-gray-700">Skipped</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {community.opportunities.total.toLocaleString()} total opportunities tracked
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

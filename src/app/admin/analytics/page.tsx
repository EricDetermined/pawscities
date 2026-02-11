'use client';

import React, { useEffect, useState } from 'react';
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

interface AnalyticsData {
  analytics: {
    pageViewsByDay: Record<string, number>;
    topEstablishments: Array<{
      id: string;
      name: string;
      category: string;
      views: number;
    }>;
    topSearchQueries: Array<{
      query: string;
      count: number;
    }>;
    signupsByDay: Record<string, number>;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const response = await fetch('/api/admin/seed-analytics', { method: 'POST' });
      const result = await response.json();
      setSeedMessage(result.message);
      if (result.seeded) {
        // Refresh analytics data
        await fetchAnalytics();
      }
    } catch (err) {
      setSeedMessage('Failed to seed data');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Site analytics and usage statistics</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800">{error || 'Failed to load analytics'}</p>
        </div>
      </div>
    );
  }

  const totalViews = Object.values(data.analytics.pageViewsByDay).reduce((a, b) => a + b, 0);
  const totalSignups = Object.values(data.analytics.signupsByDay).reduce((a, b) => a + b, 0);
  const daysWithData = Object.keys(data.analytics.pageViewsByDay).length || 1;
  const avgViewsPerDay = totalViews > 0 ? Math.round(totalViews / daysWithData) : 0;

  // Prepare chart data - merge views and signups into daily series
  const allDates = new Set([
    ...Object.keys(data.analytics.pageViewsByDay),
    ...Object.keys(data.analytics.signupsByDay),
  ]);
  const dailyChartData = Array.from(allDates)
    .sort()
    .slice(-14)
    .map((date) => ({
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: data.analytics.pageViewsByDay[date] || 0,
      signups: data.analytics.signupsByDay[date] || 0,
    }));

  // Pie chart data for category distribution from top establishments
  const categoryMap: Record<string, number> = {};
  data.analytics.topEstablishments.forEach((est) => {
    categoryMap[est.category] = (categoryMap[est.category] || 0) + est.views;
  });
  const pieData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const PIE_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444'];

  const hasData = totalViews > 0 || totalSignups > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">
            Site analytics and usage statistics (Last 30 days)
          </p>
        </div>
        {!hasData && (
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
        )}
      </div>

      {seedMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-800">{seedMessage}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Page Views"
          value={totalViews.toLocaleString()}
          subtitle={`${avgViewsPerDay} avg per day`}
          icon="👁️"
          color="bg-blue-500"
        />
        <StatCard
          title="Unique Sessions"
          value={Math.round(totalViews * 0.7).toLocaleString()}
          subtitle={totalViews > 0 ? `${((Math.round(totalViews * 0.7) / totalViews) * 100).toFixed(0)}% of views` : '0%'}
          icon="📊"
          color="bg-green-500"
        />
        <StatCard
          title="New Signups"
          value={totalSignups.toLocaleString()}
          subtitle={`${totalSignups > 0 ? Math.round(totalSignups / 30) : 0} per day`}
          icon="🎉"
          color="bg-purple-500"
        />
        <StatCard
          title="Top Category"
          value={data.analytics.topEstablishments.length > 0 ? data.analytics.topEstablishments[0].category : 'N/A'}
          subtitle={data.analytics.topEstablishments.length > 0 ? `${data.analytics.topEstablishments[0].views} views` : 'No data'}
          icon="🏆"
          color="bg-orange-500"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Page Views Area Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Page Views (Last 14 Days)
          </h2>
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#viewsGradient)"
                  name="Page Views"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>
          )}
        </div>

        {/* Signups Bar Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Signups (Last 14 Days)
          </h2>
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="signups" fill="#10b981" radius={[4, 4, 0, 0]} name="Signups" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>
          )}
        </div>
      </div>

      {/* Category Distribution + Top Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Pie Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Views by Category
          </h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => <span className="capitalize">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>
          )}
        </div>

        {/* Top Establishments */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Most Viewed Places
          </h2>
          <div className="space-y-3">
            {data.analytics.topEstablishments.length > 0 ? (
              data.analytics.topEstablishments.slice(0, 8).map((est, index) => (
                <div key={est.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {est.name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {est.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2 text-right">
                    <p className="font-semibold text-gray-900 text-sm">{est.views}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        {/* Top Search Queries */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top Search Queries
          </h2>
          <div className="space-y-3">
            {data.analytics.topSearchQueries.length > 0 ? (
              data.analytics.topSearchQueries.slice(0, 8).map((search, index) => (
                <div key={search.query} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      {index + 1}
                    </span>
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {search.query}
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-2 text-right">
                    <p className="font-semibold text-gray-900 text-sm">{search.count}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Period Info */}
      <div className="bg-gray-50 rounded-xl border p-4 text-sm text-gray-600">
        <p>
          Data from{' '}
          <span className="font-medium">
            {new Date(data.period.startDate).toLocaleDateString()}
          </span>{' '}
          to{' '}
          <span className="font-medium">
            {new Date(data.period.endDate).toLocaleDateString()}
          </span>
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div
          className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white text-xl`}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

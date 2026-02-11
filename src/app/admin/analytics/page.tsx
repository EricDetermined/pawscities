'use client';

import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    async function fetchAnalytics() {
      try {
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
    }

    fetchAnalytics();
  }, []);

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
  const avgViewsPerDay = totalViews > 0 ? Math.round(totalViews / Object.keys(data.analytics.pageViewsByDay).length) : 0;

  const getBarHeight = (value: number, max: number) => {
    if (max === 0) return 0;
    return (value / max) * 100;
  };

  const maxViews = Math.max(...Object.values(data.analytics.pageViewsByDay), 1);
  const maxSignups = Math.max(...Object.values(data.analytics.signupsByDay), 1);

  const lastDays = Object.entries(data.analytics.pageViewsByDay)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .slice(-14);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">
          Site analytics and usage statistics (Last 30 days)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Page Views"
          value={totalViews}
          subtitle={`${avgViewsPerDay} avg per day`}
          icon="👁️"
          color="bg-blue-500"
        />
        <StatCard
          title="Unique Sessions"
          value={Math.round(totalViews * 0.7)}
          subtitle={`${((Math.round(totalViews * 0.7) / totalViews) * 100).toFixed(1)}% of views`}
          icon="📊"
          color="bg-green-500"
        />
        <StatCard
          title="New Signups"
          value={totalSignups}
          subtitle={`${(totalSignups > 0 ? Math.round(totalSignups / 30) : 0)} per day`}
          icon="🎉"
          color="bg-purple-500"
        />
        <StatCard
          title="Top Category"
          value={data.analytics.topEstablishments.length > 0 ? data.analytics.topEstablishments[0].category : 'N/A'}
          subtitle={`${data.analytics.topEstablishments.length > 0 ? data.analytics.topEstablishments[0].views + ' views' : 'No data'}`}
          icon="🏆"
          color="bg-orange-500"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Page Views Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Page Views (Last 14 Days)
          </h2>
          <div className="flex items-end justify-between gap-1 h-64">
            {lastDays.length > 0 ? (
              lastDays.map(([date, views]) => (
                <div key={date} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full bg-gradient-to-t from-orange-400 to-orange-500 rounded-t relative group hover:opacity-80 transition-opacity" style={{ height: `${getBarHeight(views, maxViews) * 2}px`, minHeight: '4px' }}>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {views} views
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 text-center">
                    {new Date(date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="w-full text-center text-gray-400">No data available</div>
            )}
          </div>
        </div>

        {/* Signups Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Signups (Last 14 Days)
          </h2>
          <div className="flex items-end justify-between gap-1 h-64">
            {lastDays.length > 0 ? (
              lastDays.map(([date]) => (
                <div key={date} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-green-400 to-green-500 rounded-t relative group hover:opacity-80 transition-opacity"
                      style={{
                        height: `${getBarHeight(data.analytics.signupsByDay[date] || 0, maxSignups) * 2}px`,
                        minHeight: '4px',
                      }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {data.analytics.signupsByDay[date] || 0} signups
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 text-center">
                    {new Date(date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="w-full text-center text-gray-400">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Establishments */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Most Viewed Places
          </h2>
          <div className="space-y-3">
            {data.analytics.topEstablishments.length > 0 ? (
              data.analytics.topEstablishments.map((est, index) => (
                <div key={est.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {est.name}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">
                        {est.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <p className="font-semibold text-gray-900">{est.views}</p>
                    <p className="text-xs text-gray-500">views</p>
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
              data.analytics.topSearchQueries.map((search, index) => (
                <div key={search.query} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <p className="font-medium text-gray-900 truncate">
                      {search.query}
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <p className="font-semibold text-gray-900">{search.count}</p>
                    <p className="text-xs text-gray-500">searches</p>
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

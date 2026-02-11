'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalCities: number;
  totalEstablishments: number;
  totalUsers: number;
  pendingClaims: number;
  newUsersThisWeek: number;
  premiumListings: number;
}

interface Activity {
  id: string;
  event_type: string;
  created_at: string;
  user_id?: string;
  establishment_id?: string;
}

interface DashboardData {
  stats: Stats;
  recentActivities: Activity[];
}

const quickActions = [
  { title: 'View Claims', href: '/admin/claims', icon: '✅', color: 'bg-blue-500' },
  { title: 'Manage Users', href: '/admin/users', icon: '👥', color: 'bg-green-500' },
  { title: 'View Analytics', href: '/admin/analytics', icon: '📈', color: 'bg-orange-500' },
  { title: 'Establishments', href: '/admin/establishments', icon: '📍', color: 'bg-purple-500' },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Failed to load dashboard data');
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Loading dashboard data...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome to the Paw Cities admin dashboard</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800">
            {error || 'Failed to load dashboard data'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome to the Paw Cities admin dashboard
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cities"
          value={data.stats.totalCities}
          subtitle={`${data.stats.totalCities} active`}
          icon="🏙️"
          color="bg-blue-500"
        />
        <StatCard
          title="Establishments"
          value={data.stats.totalEstablishments}
          subtitle={`${data.stats.premiumListings} premium`}
          icon="📍"
          color="bg-green-500"
        />
        <StatCard
          title="Users"
          value={data.stats.totalUsers}
          subtitle={`${data.stats.newUsersThisWeek} new this week`}
          icon="👥"
          color="bg-purple-500"
        />
        <StatCard
          title="Pending Claims"
          value={data.stats.pendingClaims}
          subtitle="awaiting review"
          icon="✅"
          color="bg-orange-500"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center p-4 bg-white rounded-xl border hover:shadow-md transition-shadow"
            >
              <div
                className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center text-2xl mb-2`}
              >
                {action.icon}
              </div>
              <span className="font-medium text-gray-900 text-center text-sm">
                {action.title}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h2>
            <Link
              href="/admin/analytics"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View all →
            </Link>
          </div>

          <div className="space-y-4">
            {data.recentActivities && data.recentActivities.length > 0 ? (
              data.recentActivities.slice(0, 6).map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No recent activity
              </p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            System Overview
          </h2>

          <div className="space-y-4">
            <OverviewItem
              label="Active Cities"
              value={data.stats.totalCities}
              icon="🏙️"
            />
            <OverviewItem
              label="Verified Establishments"
              value={data.stats.totalEstablishments}
              icon="✔️"
            />
            <OverviewItem
              label="Premium Listings"
              value={data.stats.premiumListings}
              icon="⭐"
            />
            <OverviewItem
              label="Active Users"
              value={data.stats.totalUsers}
              icon="👤"
            />
            <OverviewItem
              label="Pending Claims"
              value={data.stats.pendingClaims}
              icon="🔔"
            />
          </div>
        </div>
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
  value: number;
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

function ActivityRow({ activity }: { activity: Activity }) {
  const getActivityIcon = (eventType: string) => {
    const icons: Record<string, string> = {
      page_view: '👁️',
      establishment_view: '📍',
      search: '🔍',
      claim_submitted: '✅',
      user_signup: '👤',
      review_added: '⭐',
    };
    return icons[eventType] || '📝';
  };

  const getActivityLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      page_view: 'Page viewed',
      establishment_view: 'Establishment viewed',
      search: 'Search performed',
      claim_submitted: 'Claim submitted',
      user_signup: 'User signed up',
      review_added: 'Review added',
    };
    return labels[eventType] || 'Activity';
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-lg">
        {getActivityIcon(activity.event_type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {getActivityLabel(activity.event_type)}
        </p>
        <p className="text-xs text-gray-400">{timeAgo(activity.created_at)}</p>
      </div>
    </div>
  );
}

function OverviewItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className="text-lg font-bold text-gray-900">{value}</span>
    </div>
  );
}

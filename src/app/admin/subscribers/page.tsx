'use client';

import React, { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  city_slug: string | null;
  source: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}

const CITY_NAMES: Record<string, string> = {
  paris: 'Paris', geneva: 'Geneva', london: 'London', barcelona: 'Barcelona',
  losangeles: 'Los Angeles', nyc: 'New York', sydney: 'Sydney', tokyo: 'Tokyo',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDate(dateStr);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'unsubscribed'>('active');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, unsubscribed: 0, thisWeek: 0 });

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscribers');
      const json = await res.json();
      if (json.subscribers) {
        setSubscribers(json.subscribers);
        setStats(json.stats || { total: 0, active: 0, unsubscribed: 0, thisWeek: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch subscribers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  // Filter and search
  const filtered = subscribers.filter(s => {
    if (filter === 'active' && s.status !== 'active') return false;
    if (filter === 'unsubscribed' && s.status !== 'unsubscribed') return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.email.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.city_slug && (CITY_NAMES[s.city_slug] || s.city_slug).toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Group by city for the breakdown
  const cityBreakdown: Record<string, number> = {};
  subscribers.filter(s => s.status === 'active').forEach(s => {
    const city = s.city_slug || 'global';
    cityBreakdown[city] = (cityBreakdown[city] || 0) + 1;
  });

  // Group by source
  const sourceBreakdown: Record<string, number> = {};
  subscribers.filter(s => s.status === 'active').forEach(s => {
    const source = s.source || 'website';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
          <p className="text-sm text-gray-500 mt-1">Newsletter subscribers and community members</p>
        </div>
        <button
          onClick={fetchSubscribers}
          disabled={loading}
          className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">New This Week</p>
          <p className="text-2xl font-bold text-blue-600">+{stats.thisWeek}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Unsubscribed</p>
          <p className="text-2xl font-bold text-gray-400">{stats.unsubscribed}</p>
        </div>
      </div>

      {/* Breakdowns */}
      {Object.keys(cityBreakdown).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* By City */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By City</h3>
            <div className="space-y-2">
              {Object.entries(cityBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{CITY_NAMES[city] || (city === 'global' ? 'No city' : city)}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* By Source */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Source</h3>
            <div className="space-y-2">
              {Object.entries(sourceBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{source}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'unsubscribed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === f ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Unsubscribed'}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by email, name, or city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Subscriber List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading subscribers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search ? 'No subscribers match your search' : 'No subscribers yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">City</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{sub.email}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {sub.name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {sub.city_slug ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                          {CITY_NAMES[sub.city_slug] || sub.city_slug}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell capitalize">
                      {sub.source || 'website'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        sub.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {formatRelative(sub.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50 text-sm text-gray-500">
            Showing {filtered.length} of {subscribers.length} subscribers
          </div>
        )}
      </div>
    </div>
  );
}

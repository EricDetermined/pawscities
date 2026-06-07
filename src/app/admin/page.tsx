'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  stats: {
    totalCities: number;
    totalEstablishments: number;
    totalUsers: number;
    pendingClaims: number;
    newUsersThisWeek: number;
    premiumListings: number;
  };
  events: {
    pending: number;
    upcoming: number;
    total: number;
  };
  subscribers: {
    total: number;
    newThisWeek: number;
  };
  social: {
    newOpportunities: number;
    unrepliedComments: number;
    totalPublished: number;
    contentRemaining: number;
    lastPostDate: string | null;
    recentPosts: {
      id: string;
      headline: string;
      city: string;
      status: string;
      likes: number;
      comments_count: number;
      created_at: string;
      error_message?: string;
    }[];
  };
  pendingEventsData: {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    venue_name: string | null;
    source: string;
    source_handle: string | null;
    external_url: string | null;
    discovery_score: number | null;
    created_at: string;
    cities: { name: string; slug: string };
  }[];
  recentActivities: {
    id: string;
    event_type: string;
    created_at: string;
  }[];
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningEvent, setActioningEvent] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEventAction = async (eventId: string, action: 'approve' | 'reject') => {
    setActioningEvent(eventId);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchData(); // Refresh data after action
      }
    } catch {
      // fail silently — will refresh anyway
    } finally {
      setActioningEvent(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800">{error || 'Failed to load'}</p>
          <button onClick={() => { setLoading(true); fetchData(); }} className="mt-2 text-sm text-red-600 underline">Retry</button>
        </div>
      </div>
    );
  }

  const totalActionItems = data.events.pending + data.social.unrepliedComments + data.stats.pendingClaims;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 text-sm">
            {totalActionItems > 0
              ? `${totalActionItems} item${totalActionItems !== 1 ? 's' : ''} need${totalActionItems === 1 ? 's' : ''} attention`
              : 'All caught up!'}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* ── Stats Ribbon ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat label="Cities" value={data.stats.totalCities} icon="🏙️" />
        <MiniStat label="Places" value={data.stats.totalEstablishments} icon="📍" sub={`${data.stats.premiumListings} premium`} />
        <MiniStat label="Users" value={data.stats.totalUsers} icon="👥" sub={`+${data.stats.newUsersThisWeek} this week`} />
        <MiniStat label="Subscribers" value={data.subscribers.total} icon="📧" sub={`+${data.subscribers.newThisWeek} this week`} href="/admin/subscribers" />
        <MiniStat label="Events" value={data.events.total} icon="📅" sub={`${data.events.upcoming} upcoming`} href="/admin/events" />
        <MiniStat label="IG Posts" value={data.social.totalPublished} icon="📸" sub={`${data.social.contentRemaining} remaining`} href="/admin/social" />
      </div>

      {/* ── Action Items Row ─────────────────────────────────────────── */}
      {totalActionItems > 0 && (
        <div className="flex flex-wrap gap-3">
          {data.events.pending > 0 && (
            <ActionBadge count={data.events.pending} label="events to review" color="rose" href="#pending-events" />
          )}
          {data.social.unrepliedComments > 0 && (
            <ActionBadge count={data.social.unrepliedComments} label="unreplied comments" color="blue" href="/admin/social" />
          )}
          {data.stats.pendingClaims > 0 && (
            <ActionBadge count={data.stats.pendingClaims} label="pending claims" color="amber" href="/admin/claims" />
          )}
          {data.social.newOpportunities > 0 && (
            <ActionBadge count={data.social.newOpportunities} label="engagement opportunities" color="green" href="/admin/social" />
          )}
        </div>
      )}

      {/* ── Main Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Pending Events — Inline Approval */}
          <section id="pending-events" className="bg-white rounded-xl border">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Pending Events</h2>
                {data.events.pending > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">{data.events.pending}</span>
                )}
              </div>
              <Link href="/admin/events" className="text-sm text-orange-600 hover:text-orange-700">View all →</Link>
            </div>
            <div className="divide-y">
              {data.pendingEventsData.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No pending events — all caught up!</div>
              ) : (
                data.pendingEventsData.map(event => {
                  const missingFields = [];
                  if (!event.source_handle) missingFields.push('handle');
                  if (!event.external_url) missingFields.push('url');
                  if (!event.venue_name) missingFields.push('venue');
                  const isReady = missingFields.length === 0;
                  return (
                  <div key={event.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{event.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{(event.cities as { name: string })?.name}</span>
                        <span>·</span>
                        <span>{new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {event.venue_name && <><span>·</span><span>{event.venue_name}</span></>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {event.source_handle ? (
                          <a href={`https://instagram.com/${event.source_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                             className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded hover:bg-purple-100">@{event.source_handle}</a>
                        ) : (
                          <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded">no handle</span>
                        )}
                        {event.external_url ? (
                          <a href={event.external_url} target="_blank" rel="noopener noreferrer"
                             className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-100 truncate max-w-[180px]">
                            {new URL(event.external_url).hostname.replace('www.', '')} ↗
                          </a>
                        ) : (
                          <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded">no url</span>
                        )}
                        {!event.venue_name && (
                          <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded">no venue</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/admin/events?edit=${event.id}`}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleEventAction(event.id, 'approve')}
                        disabled={actioningEvent === event.id || !isReady}
                        title={!isReady ? `Missing: ${missingFields.join(', ')}` : 'Approve event'}
                        className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors ${isReady ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}
                      >
                        {actioningEvent === event.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleEventAction(event.id, 'reject')}
                        disabled={actioningEvent === event.id}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Social & Content Pipeline */}
          <section className="bg-white rounded-xl border">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-gray-900">Content & Social</h2>
              <Link href="/admin/social" className="text-sm text-orange-600 hover:text-orange-700">Open Command Center →</Link>
            </div>

            {/* Pipeline Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
              <PipelineStat label="Published" value={data.social.totalPublished} icon="✅" />
              <PipelineStat label="Content Left" value={data.social.contentRemaining} icon="📝" warn={data.social.contentRemaining < 20} />
              <PipelineStat label="Engagement Queue" value={data.social.newOpportunities} icon="💬" />
              <PipelineStat label="Unreplied" value={data.social.unrepliedComments} icon="🔔" warn={data.social.unrepliedComments > 0} />
            </div>

            {/* Recent Posts */}
            <div className="p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Recent Posts</p>
              {data.social.recentPosts.length === 0 ? (
                <p className="text-sm text-gray-400">No posts yet</p>
              ) : (
                <div className="space-y-2">
                  {data.social.recentPosts.map(post => (
                    <div key={post.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${post.status === 'published' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-gray-700 truncate flex-1">{post.headline || 'Untitled'}</span>
                      <span className="text-gray-400 text-xs shrink-0">{post.city}</span>
                      {post.status === 'published' && (
                        <span className="text-gray-400 text-xs shrink-0">
                          {post.likes || 0}❤️ {post.comments_count || 0}💬
                        </span>
                      )}
                      {post.status === 'failed' && (
                        <span className="text-red-400 text-xs shrink-0">Failed</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {data.social.lastPostDate && (
                <p className="text-xs text-gray-400 mt-3">
                  Last post: {timeAgo(data.social.lastPostDate)}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ── Right Column (1/3) ── */}
        <div className="space-y-6">

          {/* Quick Navigation */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Events', href: '/admin/events', icon: '📅', count: data.events.pending },
                { label: 'Creatives', href: '/admin/creatives', icon: '🎨' },
                { label: 'Social', href: '/admin/social', icon: '📱', count: data.social.unrepliedComments },
                { label: 'Claims', href: '/admin/claims', icon: '✅', count: data.stats.pendingClaims },
                { label: 'Photos', href: '/admin/photos', icon: '📸' },
                { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
                { label: 'Health', href: '/admin/health', icon: '🏥' },
                { label: 'Users', href: '/admin/users', icon: '👥' },
                { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
              ].map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <span className="text-lg">{action.icon}</span>
                  <span className="text-gray-700 font-medium">{action.label}</span>
                  {action.count ? (
                    <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{action.count}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>

          {/* Subscriber Snapshot */}
          <section className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Subscribers</h2>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-gray-900">{data.subscribers.total}</span>
              <span className="text-sm text-gray-500">active</span>
            </div>
            {data.subscribers.newThisWeek > 0 && (
              <p className="text-sm text-green-600 font-medium">+{data.subscribers.newThisWeek} this week</p>
            )}
            {data.subscribers.total === 0 && (
              <p className="text-sm text-gray-400 mt-1">Newsletter signups will appear here</p>
            )}
          </section>

          {/* Events Summary */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Events Overview</h2>
            <div className="space-y-2">
              <OverviewRow label="Pending Review" value={data.events.pending} highlight={data.events.pending > 0} />
              <OverviewRow label="Upcoming" value={data.events.upcoming} />
              <OverviewRow label="Total Events" value={data.events.total} />
            </div>
          </section>

          {/* Platform Overview */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Platform</h2>
            <div className="space-y-2">
              <OverviewRow label="Active Cities" value={data.stats.totalCities} />
              <OverviewRow label="Establishments" value={data.stats.totalEstablishments} />
              <OverviewRow label="Premium Listings" value={data.stats.premiumListings} />
              <OverviewRow label="Registered Users" value={data.stats.totalUsers} />
              <OverviewRow label="New Users (7d)" value={data.stats.newUsersThisWeek} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ────────────────────────────────────────────────────────

function MiniStat({ label, value, icon, sub, href }: {
  label: string; value: number; icon: string; sub?: string; href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border p-4 ${href ? 'hover:shadow-sm transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ActionBadge({ count, label, color, href }: {
  count: number; label: string; color: string; href: string;
}) {
  const colors: Record<string, string> = {
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
  };
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${colors[color] || colors.blue}`}>
      <span className="font-bold">{count}</span> {label}
    </Link>
  );
}

function PipelineStat({ label, value, icon, warn }: {
  label: string; value: number; icon: string; warn?: boolean;
}) {
  return (
    <div className="bg-white p-4 text-center">
      <span className="text-lg">{icon}</span>
      <p className={`text-xl font-bold ${warn ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function OverviewRow({ label, value, highlight }: {
  label: string; value: number; highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

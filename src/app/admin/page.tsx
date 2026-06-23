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
    pendingPhotos: number;
    pendingValidation: number;
  };
  events: { pending: number; upcoming: number; total: number };
  subscribers: { total: number; newThisWeek: number };
  social: {
    newOpportunities: number;
    unrepliedComments: number;
    totalPublished: number;
    contentRemaining: number;
    lastPostDate: string | null;
    recentPosts: {
      id: string; headline: string; city: string; status: string;
      likes: number; comments_count: number; created_at: string;
      error_message?: string;
    }[];
  };
  creatives: {
    pendingReview: number;
    approved: number;
    postedThisWeek: number;
  };
  discovery: {
    needsReview: number;
    pending: number;
  };
  pendingEventsData: {
    id: string; name: string; start_date: string; end_date: string | null;
    venue_name: string | null; source: string; source_handle: string | null;
    external_url: string | null; discovery_score: number | null;
    created_at: string; cities: { name: string; slug: string };
  }[];
  pendingCreativesData: {
    id: string; headline: string; caption: string; content_type: string;
    format: string; city_slug: string; image_url: string | null;
    status: string; created_at: string;
  }[];
  discoveryData: {
    id: string; subject: string; url: string; city: string | null;
    platform: string | null; content_type: string | null;
    priority: string | null; status: string; created_at: string;
    raw_text: string | null;
  }[];
  recentActivities: { id: string; event_type: string; created_at: string }[];
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [expandedDiscovery, setExpandedDiscovery] = useState<string | null>(null);
  const [creatingEventForId, setCreatingEventForId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<{
    name: string; citySlug: string; startDate: string; endDate: string;
    venueName: string; venueAddress: string; externalUrl: string; description: string;
  }>({ name: '', citySlug: '', startDate: '', endDate: '', venueName: '', venueAddress: '', externalUrl: '', description: '' });

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

  // ── Action handlers ────────────────────────────────────────────────────

  const handleEventAction = async (eventId: string, action: 'approve' | 'reject') => {
    setActioningId(eventId);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) fetchData();
    } catch { /* silent */ } finally { setActioningId(null); }
  };

  const handleCreativeAction = async (creativeId: string, action: 'approve' | 'reject') => {
    setActioningId(creativeId);
    try {
      const res = await fetch('/api/admin/creatives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: creativeId, action }),
      });
      if (res.ok) fetchData();
    } catch { /* silent */ } finally { setActioningId(null); }
  };

  const handleBulkApproveCreatives = async () => {
    if (!data?.pendingCreativesData?.length) return;
    setActioningId('bulk');
    try {
      const res = await fetch('/api/admin/creatives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_all' }),
      });
      if (res.ok) fetchData();
    } catch { /* silent */ } finally { setActioningId(null); }
  };

  const handleIngestAction = async (itemId: string, action: 'dismiss' | 'reprocess') => {
    setActioningId(itemId);
    try {
      const res = await fetch(`/api/admin/ingest/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) fetchData();
    } catch { /* silent */ } finally { setActioningId(null); }
  };

  const handleBulkDismissIngest = async () => {
    if (!data?.discoveryData?.length) return;
    setActioningId('bulk-ingest');
    try {
      const res = await fetch('/api/admin/ingest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss_all' }),
      });
      if (res.ok) fetchData();
    } catch { /* silent */ } finally { setActioningId(null); }
  };

  const openCreateEventForm = (item: DashboardData['discoveryData'][0]) => {
    setCreatingEventForId(item.id);
    setExpandedDiscovery(item.id);
    const cityAliases: Record<string, string> = { nyc: 'newyork', ny: 'newyork', la: 'losangeles', 'los angeles': 'losangeles' };
    const rawCity = (item.city || '').toLowerCase().trim();
    const citySlug = cityAliases[rawCity] || rawCity;
    setEventForm({
      name: item.subject || '',
      citySlug,
      startDate: '',
      endDate: '',
      venueName: '',
      venueAddress: '',
      externalUrl: item.url || '',
      description: item.raw_text?.slice(0, 500) || '',
    });
  };

  const handleCreateEvent = async (itemId: string) => {
    if (!eventForm.name || !eventForm.startDate || !eventForm.citySlug) {
      alert('Name, city, and start date are required');
      return;
    }
    setActioningId(itemId);
    try {
      const res = await fetch(`/api/admin/ingest/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_event', ...eventForm }),
      });
      if (res.ok) {
        setCreatingEventForId(null);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create event');
      }
    } catch { alert('Failed to create event'); }
    finally { setActioningId(null); }
  };

  // ── Loading / Error states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
        <p className="text-gray-500 text-sm">Loading...</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
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

  // ── Compute attention items ────────────────────────────────────────────

  const attentionItems = [
    { count: data.creatives.pendingReview, label: 'creatives to review', color: 'purple', href: '#pending-creatives' },
    { count: data.discovery.needsReview, label: 'discovery items', color: 'blue', href: '#discovery-queue' },
    { count: data.events.pending, label: 'events to approve', color: 'rose', href: '#pending-events' },
    { count: data.stats.pendingClaims, label: 'business claims', color: 'amber', href: '/admin/claims' },
    { count: data.stats.pendingPhotos, label: 'photos to moderate', color: 'green', href: '/admin/photos' },
    { count: data.stats.pendingValidation, label: 'places to validate', color: 'cyan', href: '/admin/validation' },
  ].filter(item => item.count > 0);

  const totalAttention = attentionItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 text-sm">
            {totalAttention > 0
              ? `${totalAttention} item${totalAttention !== 1 ? 's' : ''} need${totalAttention === 1 ? 's' : ''} your attention`
              : 'All caught up — nothing needs review!'}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* ── Attention Banner ───────────────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attentionItems.map(item => (
            <ActionBadge key={item.label} count={item.count} label={item.label} color={item.color} href={item.href} />
          ))}
        </div>
      )}

      {/* ── Pipeline Health Ribbon ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniStat label="Approved Queue" value={data.creatives.approved} icon="✅" sub="ready to post" warn={data.creatives.approved < 14} />
        <MiniStat label="Posted (7d)" value={data.creatives.postedThisWeek} icon="📸" />
        <MiniStat label="Upcoming Events" value={data.events.upcoming} icon="📅" sub={`${data.events.total} total`} href="/admin/events" />
        <MiniStat label="Subscribers" value={data.subscribers.total} icon="📧" sub={`+${data.subscribers.newThisWeek} this week`} href="/admin/subscribers" />
        <MiniStat label="Places" value={data.stats.totalEstablishments} icon="📍" sub={`${data.stats.premiumListings} premium`} />
        <MiniStat label="Users" value={data.stats.totalUsers} icon="👥" sub={`+${data.stats.newUsersThisWeek} this week`} />
      </div>

      {/* ── Main Two-Column Layout ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left Column (2/3): Action queues ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* ──────── PENDING CREATIVES ──────── */}
          <section id="pending-creatives" className="bg-white rounded-xl border">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Pending Creatives</h2>
                {data.creatives.pendingReview > 0 && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{data.creatives.pendingReview}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {data.pendingCreativesData.length > 0 && (
                  <button
                    onClick={handleBulkApproveCreatives}
                    disabled={actioningId === 'bulk'}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {actioningId === 'bulk' ? 'Approving...' : `Approve All ${data.pendingCreativesData.length}`}
                  </button>
                )}
                <Link href="/admin/creatives" className="text-sm text-orange-600 hover:text-orange-700">View all →</Link>
              </div>
            </div>

            {data.pendingCreativesData.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No creatives waiting for review</div>
            ) : (
              <div className="divide-y">
                {data.pendingCreativesData.map(creative => (
                  <div key={creative.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                    {/* Thumbnail */}
                    {creative.image_url ? (
                      <img src={creative.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border">
                        <span className="text-2xl">🎨</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{creative.headline || 'Untitled'}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded">{creative.content_type}</span>
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded">{creative.format}</span>
                        <span>{creative.city_slug}</span>
                      </div>
                      {creative.caption && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{creative.caption}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCreativeAction(creative.id, 'approve')}
                        disabled={actioningId === creative.id}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actioningId === creative.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleCreativeAction(creative.id, 'reject')}
                        disabled={actioningId === creative.id}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ──────── PENDING EVENTS ──────── */}
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
                <div className="p-6 text-center text-gray-400 text-sm">
                  No pending events — discovery auto-approves high-confidence events.
                  <br />
                  <span className="text-xs">Low-confidence items appear in the Discovery Queue below.</span>
                </div>
              ) : (
                data.pendingEventsData.map(event => {
                  const missingFields: string[] = [];
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
                              {(() => { try { return new URL(event.external_url).hostname.replace('www.', ''); } catch { return 'link'; } })()} ↗
                            </a>
                          ) : (
                            <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded">no url</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleEventAction(event.id, 'approve')}
                          disabled={actioningId === event.id || !isReady}
                          title={!isReady ? `Missing: ${missingFields.join(', ')}` : 'Approve event'}
                          className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors ${isReady ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                          {actioningId === event.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleEventAction(event.id, 'reject')}
                          disabled={actioningId === event.id}
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

          {/* ──────── DISCOVERY QUEUE ──────── */}
          <section id="discovery-queue" className="bg-white rounded-xl border">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Discovery Queue</h2>
                {data.discovery.needsReview > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{data.discovery.needsReview}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {data.discoveryData.filter(d => d.status === 'needs_review').length > 0 && (
                  <button
                    onClick={handleBulkDismissIngest}
                    disabled={actioningId === 'bulk-ingest'}
                    className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {actioningId === 'bulk-ingest' ? 'Dismissing...' : 'Dismiss All'}
                  </button>
                )}
                <Link href="/admin/social" className="text-sm text-orange-600 hover:text-orange-700">Open Social Hub →</Link>
              </div>
            </div>
            <div className="divide-y">
              {data.discoveryData.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No discovery items need review</div>
              ) : (
                data.discoveryData.map(item => {
                  const isExpanded = expandedDiscovery === item.id;
                  const isCreating = creatingEventForId === item.id;
                  return (
                  <div key={item.id} className={`transition-colors ${isCreating ? 'bg-green-50/30' : 'hover:bg-gray-50'}`}>
                    <div
                      className="p-4 flex items-start gap-4 cursor-pointer"
                      onClick={() => setExpandedDiscovery(isExpanded ? null : item.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{item.subject}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                          {item.city && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{item.city}</span>}
                          {item.platform && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{item.platform}</span>}
                          {item.priority === 'high' && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">high priority</span>}
                          <span className="text-gray-400">{timeAgo(item.created_at)}</span>
                        </div>
                      </div>
                      {item.status === 'needs_review' && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => isCreating ? setCreatingEventForId(null) : openCreateEventForm(item)}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${isCreating ? 'text-gray-600 bg-gray-200' : 'text-green-700 bg-green-100 hover:bg-green-200'}`}
                          >
                            {isCreating ? 'Cancel' : 'Create Event'}
                          </button>
                          <button
                            onClick={() => handleIngestAction(item.id, 'dismiss')}
                            disabled={actioningId === item.id}
                            className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                      {item.status === 'processed' && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-green-600 font-medium">Processed</span>
                          <button
                            onClick={() => handleIngestAction(item.id, 'dismiss')}
                            disabled={actioningId === item.id}
                            className="px-2 py-1 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                            title="Remove from list"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <div className="shrink-0 text-gray-400">
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded detail view */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {item.raw_text && !isCreating && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-6">{item.raw_text}</p>
                          </div>
                        )}
                        {!isCreating && (
                          <div className="flex items-center gap-3">
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer"
                                 className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                View source ↗
                              </a>
                            )}
                            <span className="text-xs text-gray-400">
                              Status: {item.status} · Type: {item.content_type || 'unknown'}
                            </span>
                          </div>
                        )}

                        {/* Inline Create Event form */}
                        {isCreating && (
                          <div className="border-t border-green-200 pt-3">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="text-xs text-gray-500">Event Name *</label>
                                <input
                                  type="text" value={eventForm.name}
                                  onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-green-400 focus:border-green-400"
                                  placeholder="Event name"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">City *</label>
                                <select
                                  value={eventForm.citySlug}
                                  onChange={e => setEventForm(f => ({ ...f, citySlug: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-green-400 focus:border-green-400"
                                >
                                  <option value="">Select city</option>
                                  <option value="newyork">New York</option>
                                  <option value="london">London</option>
                                  <option value="paris">Paris</option>
                                  <option value="tokyo">Tokyo</option>
                                  <option value="sydney">Sydney</option>
                                  <option value="losangeles">Los Angeles</option>
                                  <option value="barcelona">Barcelona</option>
                                  <option value="geneva">Geneva</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Start Date *</label>
                                <input
                                  type="date" value={eventForm.startDate}
                                  onChange={e => setEventForm(f => ({ ...f, startDate: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-green-400 focus:border-green-400"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">End Date</label>
                                <input
                                  type="date" value={eventForm.endDate}
                                  onChange={e => setEventForm(f => ({ ...f, endDate: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-green-400 focus:border-green-400"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Venue</label>
                                <input
                                  type="text" value={eventForm.venueName}
                                  onChange={e => setEventForm(f => ({ ...f, venueName: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-lg"
                                  placeholder="Venue name"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">URL</label>
                                <input
                                  type="text" value={eventForm.externalUrl}
                                  onChange={e => setEventForm(f => ({ ...f, externalUrl: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-lg"
                                  placeholder="https://..."
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <span className="text-xs text-gray-400 mr-auto">
                                {!eventForm.name ? '⚠ Name required' : !eventForm.startDate ? '⚠ Date required' : !eventForm.citySlug ? '⚠ City required' : '✓ Ready to create'}
                              </span>
                              <button
                                onClick={() => setCreatingEventForId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleCreateEvent(item.id)}
                                disabled={actioningId === item.id || !eventForm.name || !eventForm.startDate || !eventForm.citySlug}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {actioningId === item.id ? 'Creating...' : 'Create & Approve Event'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
            {data.discovery.needsReview > data.discoveryData.length && (
              <div className="p-3 border-t text-center">
                <Link href="/admin/social" className="text-xs text-orange-600 hover:text-orange-700">
                  +{data.discovery.needsReview - data.discoveryData.length} more items in the full queue →
                </Link>
              </div>
            )}
          </section>

          {/* ──────── SOCIAL & CONTENT PIPELINE ──────── */}
          <section className="bg-white rounded-xl border">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-gray-900">Content Pipeline</h2>
              <Link href="/admin/social" className="text-sm text-orange-600 hover:text-orange-700">Social Hub →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
              <PipelineStat label="Published" value={data.social.totalPublished} icon="✅" />
              <PipelineStat label="Content Left" value={data.social.contentRemaining} icon="📝" warn={data.social.contentRemaining < 20} />
              <PipelineStat label="Ready to Post" value={data.creatives.approved} icon="📤" warn={data.creatives.approved < 14} />
              <PipelineStat label="Pending Review" value={data.creatives.pendingReview} icon="👀" warn={data.creatives.pendingReview > 0} />
            </div>
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
                    </div>
                  ))}
                </div>
              )}
              {data.social.lastPostDate && (
                <p className="text-xs text-gray-400 mt-3">Last post: {timeAgo(data.social.lastPostDate)}</p>
              )}
            </div>
          </section>
        </div>

        {/* ── Right Column (1/3): Overview panels ── */}
        <div className="space-y-6">

          {/* Your Role Explainer */}
          <section className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-2">Your Role</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium text-gray-800">You review.</span> Approve creatives before they post. Review discovered events. Moderate photos.</p>
              <p><span className="font-medium text-gray-800">Automation handles.</span> Event discovery, creative generation, scheduling, posting, photo enrichment — all run on cron.</p>
            </div>
          </section>

          {/* Quick Navigation */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Quick Links</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Events', href: '/admin/events', icon: '📅', count: data.events.pending },
                { label: 'Creatives', href: '/admin/creatives', icon: '🎨', count: data.creatives.pendingReview },
                { label: 'Social Hub', href: '/admin/social', icon: '📱' },
                { label: 'Claims', href: '/admin/claims', icon: '✅', count: data.stats.pendingClaims },
                { label: 'Photos', href: '/admin/photos', icon: '📸', count: data.stats.pendingPhotos },
                { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
                { label: 'Health', href: '/admin/health', icon: '🏥' },
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

          {/* Events Summary */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Events Overview</h2>
            <div className="space-y-2">
              <OverviewRow label="Pending Review" value={data.events.pending} highlight={data.events.pending > 0} />
              <OverviewRow label="Upcoming" value={data.events.upcoming} />
              <OverviewRow label="Total Events" value={data.events.total} />
            </div>
          </section>

          {/* Pipeline Summary */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Creative Pipeline</h2>
            <div className="space-y-2">
              <OverviewRow label="Pending Review" value={data.creatives.pendingReview} highlight={data.creatives.pendingReview > 0} />
              <OverviewRow label="Approved (queue)" value={data.creatives.approved} />
              <OverviewRow label="Posted (7 days)" value={data.creatives.postedThisWeek} />
              <OverviewRow label="Days of content" value={Math.floor(data.creatives.approved / 4)} warn={data.creatives.approved < 14} />
            </div>
          </section>

          {/* Discovery Summary */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Discovery</h2>
            <div className="space-y-2">
              <OverviewRow label="Needs Review" value={data.discovery.needsReview} highlight={data.discovery.needsReview > 0} />
              <OverviewRow label="Processing" value={data.discovery.pending} />
            </div>
          </section>

          {/* Subscriber Snapshot */}
          <section className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Subscribers</h2>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-gray-900">{data.subscribers.total}</span>
              <span className="text-sm text-gray-500">active</span>
            </div>
            {data.subscribers.newThisWeek > 0 && (
              <p className="text-sm text-green-600 font-medium">+{data.subscribers.newThisWeek} this week</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ────────────────────────────────────────────────────────

function MiniStat({ label, value, icon, sub, href, warn }: {
  label: string; value: number; icon: string; sub?: string; href?: string; warn?: boolean;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border p-4 ${href ? 'hover:shadow-sm transition-shadow cursor-pointer' : ''} ${warn ? 'border-orange-200' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${warn ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
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
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  return (
    <a href={href} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors hover:opacity-80 ${colors[color] || colors.blue}`}>
      <span className="font-bold">{count}</span> {label}
    </a>
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

function OverviewRow({ label, value, highlight, warn }: {
  label: string; value: number; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-orange-600' : warn ? 'text-orange-600' : 'text-gray-900'}`}>{value}</span>
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

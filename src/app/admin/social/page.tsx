'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ──────────────── Helpers ──────────────── */

/** Ensure a URL has a protocol prefix so it doesn't become a relative link */
function ensureUrl(url: string | null | undefined): string {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

/* ──────────────── Types ──────────────── */

interface Opportunity {
  id: string;
  permalink: string;
  caption: string;
  category: string;
  suggested_reply: string;
  likes: number;
  comments: number;
  source_username: string | null;
  hashtag: string | null;
  status: string;
}

interface OutreachItem {
  id: string;
  eventName: string;
  handle: string;
  sourcePostUrl: string | null;
  cityName: string;
  startDate: string;
  suggestedComments: string[];
}

interface InvitationItem {
  id: string;
  eventName: string;
  venueName: string;
  venueAddress: string | null;
  cityName: string;
  sourceHandle: string | null;
  startDate: string;
  dmTemplate: string;
}

interface CommentItem {
  id: string;
  username: string;
  text: string;
  post_id: string;
  replied: boolean;
  commented_at: string;
}

interface PostItem {
  id: string;
  headline: string;
  city: string;
  status: string;
  posted_at: string;
  likes: number;
  comments_count: number;
  error_message: string | null;
  post_id: string | null;
}

interface ActionRecord {
  entity_type: string;
  entity_id: string;
  completed: boolean;
  completed_at: string | null;
}

interface PerformanceStats {
  totalPublished: number;
  totalFailed: number;
  avgLikes: number;
  avgComments: number;
  contentRemaining: number;
}

interface CalendarItem {
  id: string;
  headline: string;
  narrator: string;
  city: string;
  status: string;
  scheduled_for: string | null;
  image_url: string | null;
  caption: string;
  format: string;
}

interface DiscoveryItem {
  id: string;
  source: string;
  classification: string;
  city_slug: string;
  raw_data: Record<string, unknown>;
  status: string;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
}

interface PendingEvent {
  id: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  start_date: string;
  end_date: string | null;
  source_handle: string | null;
  source_post_url: string | null;
  image_url: string | null;
  tags: string[];
  is_free: boolean;
  created_at: string;
  cities: { name: string; slug: string };
}

type TabId = 'pipeline' | 'calendar' | 'engagement' | 'outreach' | 'invitations' | 'comments' | 'performance' | 'operations';

/* ──────────────── Helpers ──────────────── */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

/* ──────────────── Component ──────────────── */

export default function SocialCommandCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');
  const [loading, setLoading] = useState(true);

  // Data
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [outreach, setOutreach] = useState<OutreachItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<DiscoveryItem[]>([]);
  const [discoverySummary, setDiscoverySummary] = useState<{ total: number; bySource: Record<string, number>; byCity: Record<string, number> } | null>(null);
  const [pendingEvents, setPendingEventsData] = useState<PendingEvent[]>([]);
  const [approvingEvent, setApprovingEvent] = useState<string | null>(null);

  // Action tracking
  const [actions, setActions] = useState<ActionRecord[]>([]);

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick DM composer state
  const [quickDmBusiness, setQuickDmBusiness] = useState('');
  const [quickDmCity, setQuickDmCity] = useState('');
  const [quickDmContext, setQuickDmContext] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, outRes, invRes, comRes, perfRes, actRes, calRes, discRes, pendRes] = await Promise.all([
        fetch('/api/admin/social?type=opportunities').then(r => r.json()),
        fetch('/api/admin/social?type=outreach').then(r => r.json()),
        fetch('/api/admin/social?type=invitations').then(r => r.json()),
        fetch('/api/admin/social?type=comments').then(r => r.json()),
        fetch('/api/admin/social?type=performance').then(r => r.json()),
        fetch('/api/admin/social?type=actions').then(r => r.json()),
        fetch('/api/admin/creatives?limit=30').then(r => r.json()),
        fetch('/api/admin/social?type=discovery').then(r => r.json()),
        fetch('/api/admin/social?type=pending-events').then(r => r.json()),
      ]);
      setOpportunities(oppRes.opportunities || []);
      setOutreach(outRes.outreach || []);
      setInvitations(invRes.invitations || []);
      setComments(comRes.comments || []);
      setPosts(perfRes.posts || []);
      setPerfStats(perfRes.stats || null);
      setActions(actRes.actions || []);
      setCalendarItems(calRes.items || []);
      setDiscoveryItems(discRes.items || []);
      setDiscoverySummary(discRes.summary || null);
      setPendingEventsData(pendRes.events || []);
    } catch (err) {
      console.error('Failed to fetch social data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* --- Actions --- */

  const markEngaged = async (id: string) => {
    await fetch('/api/admin/social', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'opportunity', status: 'engaged' }),
    });
    setOpportunities(prev => prev.filter(o => o.id !== id));
  };

  const skipOpportunity = async (id: string) => {
    await fetch('/api/admin/social', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'opportunity', status: 'skipped' }),
    });
    setOpportunities(prev => prev.filter(o => o.id !== id));
  };

  const markReplied = async (id: string) => {
    await fetch('/api/admin/social', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'comment', replied: true }),
    });
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEventAction = async (eventId: string, action: 'approve' | 'reject') => {
    setApprovingEvent(eventId);
    try {
      const res = await fetch('/api/admin/social', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'event-action', id: eventId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingEventsData(prev => prev.filter(e => e.id !== eventId));
        fetchData(); // Refresh all counts
      }
    } catch (err) {
      console.error('Event action failed:', err);
    } finally {
      setApprovingEvent(null);
    }
  };

  /** Check if an action is completed */
  const isActionDone = (entityType: string, entityId: string): boolean => {
    return actions.some(a => a.entity_type === entityType && a.entity_id === entityId && a.completed);
  };

  /** Toggle an action's completed state */
  const toggleAction = async (entityType: string, entityId: string) => {
    const current = isActionDone(entityType, entityId);
    const newVal = !current;

    // Optimistic update
    setActions(prev => {
      const existing = prev.find(a => a.entity_type === entityType && a.entity_id === entityId);
      if (existing) {
        return prev.map(a =>
          a.entity_type === entityType && a.entity_id === entityId
            ? { ...a, completed: newVal, completed_at: newVal ? new Date().toISOString() : null }
            : a
        );
      }
      return [...prev, { entity_type: entityType, entity_id: entityId, completed: newVal, completed_at: newVal ? new Date().toISOString() : null }];
    });

    // Persist to server
    await fetch('/api/admin/social', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'action', entityType, entityId, completed: newVal }),
    });
  };

  /* --- Counts --- */
  const pendingOpps = opportunities.filter(o => o.status === 'new');
  const unrepliedComments = comments.filter(c => !c.replied);
  const outreachPending = outreach.filter(o => !isActionDone('outreach_reply', o.id));
  const invitationsPending = invitations.filter(i => !isActionDone('invitation_dm', i.id));
  const calendarUpcoming = calendarItems.filter(c => c.status === 'approved' || c.status === 'pending_review');

  const tabs: { id: TabId; label: string; count?: number; icon: string }[] = [
    { id: 'pipeline', label: 'Pipeline', count: pendingEvents.length, icon: '🔄' },
    { id: 'calendar', label: 'Content Calendar', count: calendarUpcoming.length, icon: '🗓️' },
    { id: 'engagement', label: 'Engagement', count: pendingOpps.length, icon: '💬' },
    { id: 'outreach', label: 'Outreach', count: outreachPending.length, icon: '📣' },
    { id: 'invitations', label: 'Invitations', count: invitationsPending.length, icon: '🤝' },
    { id: 'comments', label: 'Comments', count: unrepliedComments.length, icon: '💭' },
    { id: 'performance', label: 'Performance', icon: '📊' },
    { id: 'operations', label: 'Operations', icon: '⚡' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading Social Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Command Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pendingEvents.length > 0 && <><span className="text-orange-600 font-medium">{pendingEvents.length} events to review</span> &middot; </>}
            {calendarUpcoming.length} posts scheduled &middot; {discoveryItems.length} discovered (7d) &middot; {unrepliedComments.length} unreplied
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            Refresh
          </button>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">Back to Admin</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════ PIPELINE TAB ═══════ */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* ── Pipeline Flow Visualization ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Flow</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Discovered', count: discoverySummary?.total || 0, color: 'bg-indigo-100 text-indigo-700 border-indigo-200', sub: '7 days' },
                { label: 'Pending Review', count: pendingEvents.length, color: pendingEvents.length > 0 ? 'bg-orange-100 text-orange-700 border-orange-300 ring-2 ring-orange-200' : 'bg-orange-50 text-orange-600 border-orange-200', sub: 'events' },
                { label: 'Approved Events', count: calendarItems.filter(c => c.status === 'approved' && c.format === 'event').length, color: 'bg-green-100 text-green-700 border-green-200', sub: 'in queue' },
                { label: 'Creative Review', count: calendarItems.filter(c => c.status === 'pending_review').length, color: 'bg-purple-100 text-purple-700 border-purple-200', sub: 'creatives' },
                { label: 'Ready to Post', count: calendarItems.filter(c => c.status === 'approved').length, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', sub: 'creatives' },
                { label: 'Posted', count: calendarItems.filter(c => c.status === 'posted').length, color: 'bg-blue-100 text-blue-700 border-blue-200', sub: 'all time' },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  {i > 0 && <span className="text-gray-300 text-lg">→</span>}
                  <div className={`rounded-lg border px-3 py-2 text-center min-w-[100px] ${step.color}`}>
                    <p className="text-xl font-bold">{step.count}</p>
                    <p className="text-xs font-medium">{step.label}</p>
                    <p className="text-xs opacity-60">{step.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Discovery Summary ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>🔍</span> Recent Discoveries
              <span className="text-xs font-normal text-gray-400">(last 7 days)</span>
            </h3>

            {discoverySummary && discoverySummary.total > 0 ? (
              <>
                <div className="flex gap-4 mb-4 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">By Source</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(discoverySummary.bySource).map(([source, count]) => {
                        const sourceStyles: Record<string, string> = {
                          instagram: 'bg-pink-100 text-pink-700',
                          google_events: 'bg-blue-100 text-blue-700',
                          vision: 'bg-purple-100 text-purple-700',
                          manual: 'bg-gray-100 text-gray-600',
                        };
                        return (
                          <span key={source} className={`px-2 py-1 rounded-full text-xs font-medium ${sourceStyles[source] || 'bg-gray-100 text-gray-600'}`}>
                            {source === 'google_events' ? 'Google' : source}: {count}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">By City</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(discoverySummary.byCity).sort(([,a], [,b]) => b - a).map(([city, count]) => (
                        <span key={city} className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {city}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent discovery items */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {discoveryItems.slice(0, 20).map(item => {
                    const rawData = item.raw_data || {};
                    const title = (rawData.title || rawData.name || rawData.caption || 'Untitled') as string;
                    const sourceLabel = item.source === 'google_events' ? 'Google' : item.source;
                    const statusColor = item.status === 'processed' ? 'text-green-600' : item.status === 'failed' ? 'text-red-500' : 'text-gray-400';
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'processed' ? 'bg-green-400' : item.status === 'failed' ? 'bg-red-400' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{title.slice(0, 80)}</p>
                          <p className="text-xs text-gray-400">
                            {sourceLabel} &middot; {item.city_slug} &middot; {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className={`text-xs font-medium ${statusColor}`}>{item.status}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState icon="🔍" message="No discoveries in the last 7 days. The event discovery cron runs daily at 8 AM UTC." />
            )}
          </div>

          {/* ── Pending Event Approval ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>⏳</span> Events Awaiting Approval
              {pendingEvents.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{pendingEvents.length}</span>
              )}
            </h3>

            {pendingEvents.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No events pending review. All caught up!</p>
            ) : (
              <div className="space-y-3">
                {pendingEvents.map(event => (
                  <div key={event.id} className="border border-orange-200 rounded-lg p-4 bg-orange-50/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{event.cities?.name || 'Unknown'}</span>
                          <span className="text-xs text-gray-400">{formatDate(event.start_date)}{event.end_date ? ` - ${formatDate(event.end_date)}` : ''}</span>
                          {event.is_free && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Free</span>}
                          {event.source_handle && (
                            <a href={event.source_post_url ? ensureUrl(event.source_post_url) : `https://instagram.com/${event.source_handle.replace('@', '')}`}
                               target="_blank" rel="noopener noreferrer"
                               className="text-xs text-purple-500 hover:underline">via {event.source_handle}</a>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900">{event.name}</h4>
                        {event.venue_name && <p className="text-sm text-gray-600 mt-0.5">📍 {event.venue_name}{event.venue_address ? `, ${event.venue_address}` : ''}</p>}
                        {event.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>}
                        {event.tags && event.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {event.tags.map(tag => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">#{tag}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">Discovered {new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      {/* Thumbnail if available */}
                      {event.image_url && (
                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-orange-200">
                      <button
                        onClick={() => handleEventAction(event.id, 'approve')}
                        disabled={approvingEvent === event.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {approvingEvent === event.id ? '...' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => handleEventAction(event.id, 'reject')}
                        disabled={approvingEvent === event.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        ✗ Reject
                      </button>
                      {event.source_post_url && (
                        <a href={ensureUrl(event.source_post_url)} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 ml-auto">
                          View Source →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ CONTENT CALENDAR TAB ═══════ */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex-1">
              <p className="text-sm text-orange-800">
                <strong>Buster &amp; Marley content pipeline</strong> — Approved posts auto-publish daily at 2PM UTC.
                Review, edit captions, change dates, or regenerate images from here.
              </p>
            </div>
            <Link
              href="/admin/creatives"
              className="ml-3 text-sm text-orange-600 hover:text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 whitespace-nowrap"
            >
              Full Creative Review →
            </Link>
          </div>

          {/* Status summary */}
          {(() => {
            const byStatus: Record<string, CalendarItem[]> = {};
            calendarItems.forEach(item => {
              if (!byStatus[item.status]) byStatus[item.status] = [];
              byStatus[item.status].push(item);
            });
            const statusLabels: Record<string, { label: string; color: string }> = {
              pending_review: { label: 'Pending Review', color: 'bg-orange-100 text-orange-700' },
              approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
              posted: { label: 'Posted', color: 'bg-blue-100 text-blue-700' },
              rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
              failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
            };
            return (
              <div className="flex gap-3 flex-wrap">
                {Object.entries(byStatus).map(([status, items]) => {
                  const style = statusLabels[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
                  return (
                    <span key={status} className={`px-3 py-1 rounded-full text-xs font-medium ${style.color}`}>
                      {style.label}: {items.length}
                    </span>
                  );
                })}
              </div>
            );
          })()}

          {calendarItems.length === 0 ? (
            <EmptyState icon="🗓️" message="No scheduled content yet. Generate a batch from the Creative Review page." />
          ) : (
            <div className="space-y-3">
              {calendarItems.map(item => {
                const narratorStyles: Record<string, { emoji: string; color: string; name: string }> = {
                  buster: { emoji: '🐕', color: 'bg-amber-100 text-amber-700', name: 'Buster' },
                  marley: { emoji: '🐩', color: 'bg-blue-100 text-blue-700', name: 'Marley' },
                  both: { emoji: '🐾', color: 'bg-purple-100 text-purple-700', name: 'Both' },
                };
                const n = narratorStyles[item.narrator] || narratorStyles.both;
                const statusColors: Record<string, string> = {
                  pending_review: 'text-orange-600',
                  approved: 'text-green-600',
                  posted: 'text-blue-600',
                  rejected: 'text-red-500',
                  failed: 'text-red-600',
                };

                return (
                  <div key={item.id} className="bg-white rounded-xl border hover:shadow-sm transition-shadow p-4 flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.headline} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{n.emoji}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${n.color}`}>
                          {n.emoji} {n.name}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{item.city}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className={`text-xs font-medium ${statusColors[item.status] || 'text-gray-500'}`}>
                          {item.status === 'pending_review' ? 'Review' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                        {item.scheduled_for && (
                          <>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-500">
                              📅 {new Date(item.scheduled_for + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 text-sm truncate">{item.headline}</p>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.caption.split('\n')[0]}</p>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'pending_review' && (
                        <button
                          onClick={async () => {
                            await fetch('/api/admin/creatives', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: item.id, action: 'approve' }),
                            });
                            fetchData();
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                        >
                          ✓ Approve
                        </button>
                      )}
                      {item.status === 'posted' && item.image_url && (
                        <span className="text-xs text-blue-500 font-medium">✓ Live</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ ENGAGEMENT TAB ═══════ */}
      {activeTab === 'engagement' && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-purple-800">
              <strong>Engagement opportunities</strong> found by scanning hashtags daily. Open the post on Instagram, comment with the suggested reply, then mark as engaged.
            </p>
          </div>

          {pendingOpps.length === 0 ? (
            <EmptyState icon="🎉" message="No pending opportunities. The outreach agent runs daily at 11 AM UTC." />
          ) : pendingOpps.map(opp => (
            <div key={opp.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <CategoryBadge category={opp.category} />
                {opp.hashtag && <span className="text-xs text-gray-400">#{opp.hashtag}</span>}
                {opp.source_username && <span className="text-xs text-gray-400">@{opp.source_username}</span>}
                <span className="text-xs text-gray-400">{opp.likes} likes</span>
              </div>
              <p className="text-sm text-gray-700 mb-3 line-clamp-2">{opp.caption}</p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-orange-800">Suggested Reply:</p>
                  <button onClick={() => handleCopy(opp.suggested_reply, `opp-${opp.id}`)} className="text-xs text-orange-600 hover:underline">
                    {copiedId === `opp-${opp.id}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-orange-700">{opp.suggested_reply}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={opp.permalink} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline font-medium">Open on Instagram →</a>
                <button onClick={() => markEngaged(opp.id)} className="text-sm text-green-600 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-50">Mark Engaged</button>
                <button onClick={() => skipOpportunity(opp.id)} className="text-sm text-gray-400 hover:underline">Skip</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ OUTREACH TAB ═══════ */}
      {activeTab === 'outreach' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-800">
              <strong>Outreach suggestions</strong> for commenting on event source handles. These are the Instagram accounts that posted about upcoming events. Engage with them to build relationships and drive traffic.
            </p>
          </div>

          {outreach.length === 0 ? (
            <EmptyState icon="📣" message="No outreach targets found. Events without source handles won't appear here." />
          ) : [...outreach].sort((a, b) => {
            const aDone = isActionDone('outreach_reply', a.id);
            const bDone = isActionDone('outreach_reply', b.id);
            return aDone === bDone ? 0 : aDone ? 1 : -1;
          }).map((item) => {
            const done = isActionDone('outreach_reply', item.id);
            return (
              <div key={item.id} className={`bg-white rounded-xl border p-5 transition-all ${done ? 'border-green-200 opacity-75' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleAction('outreach_reply', item.id)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                    />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${done ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{item.handle}</span>
                  </label>
                  <span className="text-xs text-gray-400">{item.cityName}</span>
                  <span className="text-xs text-gray-400">{formatDate(item.startDate)}</span>
                  {done && <span className="text-xs text-green-600">✓ Replied</span>}
                </div>
                <h3 className={`font-medium mb-3 ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>Re: {item.eventName}</h3>

                {!done && (() => {
                  const isJapanese = item.cityName === 'Tokyo';
                  const japaneseComments = isJapanese ? [
                    `素敵ですね！🐾 ${item.eventName}をpawcities.comの犬と楽しめるイベントカレンダーに掲載させていただきました。東京の愛犬家の方々にもっと知っていただけると嬉しいです！`,
                    `いいですね！私たちはpawcities.comで犬に優しいスポットやイベントを紹介しています。${item.eventName}も掲載させていただきました。イベント情報の投稿はいつでも無料です 🙌`,
                  ] : [];
                  const allComments = [...item.suggestedComments, ...japaneseComments];

                  return (
                    <div className="space-y-2 mb-3">
                      {allComments.map((comment, i) => (
                        <div key={i} className={`border rounded-lg p-3 flex items-start gap-3 ${i >= item.suggestedComments.length ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex-1">
                            {i >= item.suggestedComments.length && <p className="text-xs text-rose-500 font-medium mb-1">日本語</p>}
                            <p className="text-sm text-gray-700">{comment}</p>
                          </div>
                          <button
                            onClick={() => handleCopy(comment, `out-${item.id}-${i}`)}
                            className="text-xs text-orange-600 border border-orange-200 px-2 py-1 rounded hover:bg-orange-50 whitespace-nowrap"
                          >
                            {copiedId === `out-${item.id}-${i}` ? '✓' : 'Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="flex items-center gap-3">
                  {item.sourcePostUrl ? (
                    <a href={ensureUrl(item.sourcePostUrl)} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:underline font-medium">
                      Open Source Post →
                    </a>
                  ) : (
                    <a href={`https://instagram.com/${item.handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:underline font-medium">
                      View Profile →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ INVITATIONS TAB ═══════ */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Business invitations</strong> — DM templates to invite event venues to list on Paw Cities. Copy the message and send via Instagram DM.
            </p>
          </div>

          {/* Quick DM Composer */}
          <div className="bg-white rounded-xl border-2 border-dashed border-amber-300 p-5 mb-4">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <span>✍️</span> Quick DM — Invite Any Business
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                placeholder="Business name"
                value={quickDmBusiness}
                onChange={(e) => setQuickDmBusiness(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-amber-500 focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="City (e.g. London)"
                value={quickDmCity}
                onChange={(e) => setQuickDmCity(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-amber-500 focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Context (e.g. dog-friendly section, event name)"
                value={quickDmContext}
                onChange={(e) => setQuickDmContext(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            {quickDmBusiness && quickDmCity && (() => {
              const dm = `Hi ${quickDmBusiness}! 👋\n\n` +
                (quickDmContext
                  ? `We noticed ${quickDmContext} — that's awesome! `
                  : `We love what you're doing for dog owners! `) +
                `We run Paw Cities (pawcities.com), a free directory of dog-friendly places across ${quickDmCity} and 7 other cities worldwide.\n\n` +
                `We'd love to list ${quickDmBusiness} on our site so more dog owners can discover you. ` +
                `It's completely free — you can claim your listing at pawcities.com and add your details, photos, and upcoming events.\n\n` +
                `Let us know if you have any questions! 🐾`;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-amber-700">Generated DM:</p>
                    <div className="flex items-center gap-2">
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(quickDmBusiness + ' ' + quickDmCity + ' instagram')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                        Find on IG
                      </a>
                      <button onClick={() => handleCopy(dm, 'quick-dm')} className="text-xs text-amber-600 hover:underline">
                        {copiedId === 'quick-dm' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-amber-800 whitespace-pre-line">{dm}</p>
                </div>
              );
            })()}
          </div>

          {invitations.length === 0 ? (
            <EmptyState icon="🤝" message="No venues to invite. Events without venue names won't appear here." />
          ) : [...invitations].sort((a, b) => {
            const aDone = isActionDone('invitation_dm', a.id);
            const bDone = isActionDone('invitation_dm', b.id);
            return aDone === bDone ? 0 : aDone ? 1 : -1;
          }).map(inv => {
            const done = isActionDone('invitation_dm', inv.id);
            return (
              <div key={inv.id} className={`bg-white rounded-xl border p-5 transition-all ${done ? 'border-green-200 opacity-75' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleAction('invitation_dm', inv.id)}
                      className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{inv.cityName}</span>
                  </label>
                  <span className="text-xs text-gray-400">{formatDate(inv.startDate)}</span>
                  {done && <span className="text-xs text-green-600">✓ DM Sent</span>}
                </div>
                <h3 className={`font-medium mb-1 ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{inv.venueName}</h3>
                <p className="text-sm text-gray-500 mb-1">Hosting: {inv.eventName}</p>
                {inv.sourceHandle && (
                  <p className="text-xs text-gray-400 mb-3">
                    Found via{' '}
                    <a href={`https://instagram.com/${inv.sourceHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">
                      {inv.sourceHandle}
                    </a>
                  </p>
                )}

                {!done && (() => {
                  const isJapanese = inv.cityName === 'Tokyo';
                  const englishDm = inv.dmTemplate;
                  const japaneseDm = `${inv.venueName}様、こんにちは！👋\n\n` +
                    `「${inv.eventName}」を開催されているとお見かけしました。素晴らしいですね！\n\n` +
                    `私たちはPaw Cities（pawcities.com）を運営しており、東京をはじめ世界8都市の犬に優しいスポットを紹介する無料ディレクトリです。\n\n` +
                    `${inv.venueName}様をサイトに掲載させていただき、より多くの愛犬家の方々に知っていただけたらと思います。掲載は完全無料です。pawcities.comで店舗情報、写真、イベント情報などをご登録いただけます。\n\n` +
                    `ご不明な点がございましたら、お気軽にお問い合わせください！🐾`;

                  return (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-amber-700">DM Template (English):</p>
                          <button onClick={() => handleCopy(englishDm, `inv-${inv.id}`)} className="text-xs text-amber-600 hover:underline">
                            {copiedId === `inv-${inv.id}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-sm text-amber-800 whitespace-pre-line">{englishDm}</p>
                      </div>
                      {isJapanese && (
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-rose-700">DM Template (日本語):</p>
                            <button onClick={() => handleCopy(japaneseDm, `inv-jp-${inv.id}`)} className="text-xs text-rose-600 hover:underline">
                              {copiedId === `inv-jp-${inv.id}` ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-sm text-rose-800 whitespace-pre-line">{japaneseDm}</p>
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="flex flex-wrap items-center gap-3">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(inv.venueName + ' ' + inv.cityName + ' instagram')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-600 hover:underline font-medium">
                    Find {inv.venueName} on IG →
                  </a>
                  {inv.venueAddress && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inv.venueName + ', ' + inv.venueAddress)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:underline">
                      Maps
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ COMMENTS TAB ═══════ */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-sky-800">
              <strong>Unreplied comments</strong> on your PawCities Instagram posts. Reply to keep your community engaged, then mark as replied.
            </p>
          </div>

          {unrepliedComments.length === 0 ? (
            <EmptyState icon="💬" message="All caught up! No unreplied comments." />
          ) : unrepliedComments.map(comment => (
            <div key={comment.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm">
                  <strong className="text-gray-900">@{comment.username}</strong>{' '}
                  <span className="text-gray-600">{comment.text}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">{new Date(comment.commented_at).toLocaleString()}</p>
              </div>
              <button onClick={() => markReplied(comment.id)} className="text-xs text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 whitespace-nowrap">
                Mark Replied
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ PERFORMANCE TAB ═══════ */}
      {activeTab === 'performance' && (
        <div>
          {/* Stats grid */}
          {perfStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <StatCard label="Published" value={perfStats.totalPublished} color="green" />
              <StatCard label="Failed" value={perfStats.totalFailed} color="red" />
              <StatCard label="Avg Likes" value={perfStats.avgLikes} color="orange" />
              <StatCard label="Avg Comments" value={perfStats.avgComments} color="blue" />
              <StatCard label="Content Left" value={perfStats.contentRemaining} color="gray" />
            </div>
          )}

          {/* Post history */}
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Posts</h3>
          <div className="space-y-2">
            {posts.map(post => (
              <div key={post.id} className={`bg-white rounded-lg border p-4 flex items-center justify-between ${post.status === 'failed' ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${post.status === 'published' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <p className="text-sm font-medium text-gray-900 truncate">{post.headline}</p>
                    {post.city && <span className="text-xs text-gray-400">{post.city}</span>}
                  </div>
                  {post.error_message && <p className="text-xs text-red-500 mt-1 truncate">{post.error_message}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 ml-4">
                  {post.status === 'published' && (
                    <>
                      <span>❤️ {post.likes || 0}</span>
                      <span>💬 {post.comments_count || 0}</span>
                    </>
                  )}
                  <span>{post.posted_at ? new Date(post.posted_at).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ OPERATIONS TAB ═══════ */}
      {activeTab === 'operations' && (
        <OperationsPanel />
      )}
    </div>
  );
}

/* ──────────────── Operations Panel ──────────────── */

function OperationsPanel() {
  const [queueStats, setQueueStats] = useState<{
    unreplied: number;
    total: number;
    bySentiment: Record<string, number>;
    oldestUnrepliedHoursAgo: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: string; data: Record<string, unknown> } | null>(null);
  const [replyLimit, setReplyLimit] = useState(25);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/social/operations');
      const data = await res.json();
      setQueueStats(data.queue);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Timer for elapsed time during operations
  useEffect(() => {
    if (!running) return;
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const addLog = (msg: string) => setProgressLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runOperation = async (action: string) => {
    setRunning(action);
    setResult(null);
    setProgressLog([]);

    if (action === 'scrape_and_reply') {
      addLog('Starting full pipeline...');
      addLog('Step 1/3: Purging stale comments (>48hrs)...');
    } else if (action === 'reply_queue') {
      addLog(`Starting reply to ${replyLimit} comments from queue...`);
    } else if (action === 'purge_stale') {
      addLog('Purging stale unreplied comments...');
    }

    try {
      const res = await fetch('/api/admin/social/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, limit: replyLimit }),
      });
      const data = await res.json();

      // Parse result for user-friendly log entries
      if (data.purgeResult) {
        addLog(`Purged ${data.purgeResult.purged || 0} stale comments`);
      }
      if (action === 'scrape_and_reply' && data.scrapeResult) {
        const sr = data.scrapeResult as Record<string, unknown>;
        addLog('Step 2/3: Scraped Instagram for new comments');
        addLog(`Step 3/3: Auto-replied to comments`);
        if (sr.newComments !== undefined) addLog(`New comments found: ${sr.newComments}`);
        if (sr.autoRepliesSent !== undefined) addLog(`Auto-replies sent: ${sr.autoRepliesSent}`);
        if (sr.questionsFound !== undefined) addLog(`Questions flagged: ${sr.questionsFound}`);
      }
      if (action === 'reply_queue' && data.replyResult) {
        const rr = data.replyResult as Record<string, unknown>;
        addLog(`Processed ${rr.total || 0} comments`);
        addLog(`Replied: ${rr.replied || 0} | Skipped: ${rr.skipped || 0} | Errors: ${rr.errors || 0}`);
      }

      addLog(data.success ? 'Done!' : `Error: ${data.error || 'Unknown'}`);
      setResult({ action, data });
      await fetchStats();
    } catch (err) {
      addLog(`Error: ${String(err)}`);
      setResult({ action, data: { error: String(err) } });
    }
    setRunning(null);
  };

  if (loading) return <div className="text-center text-gray-400 py-12">Loading queue stats...</div>;

  return (
    <div className="space-y-6">
      {/* Queue Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Comment Queue Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="Unreplied" value={queueStats?.unreplied || 0} color="orange" />
          <StatCard label="Total Comments" value={queueStats?.total || 0} color="gray" />
          <StatCard label="Questions" value={queueStats?.bySentiment?.question || 0} color="blue" />
          <StatCard label="Oldest (hrs)" value={queueStats?.oldestUnrepliedHoursAgo || 0} color={
            (queueStats?.oldestUnrepliedHoursAgo || 0) > 48 ? 'red' : 'green'
          } />
        </div>
        {queueStats?.bySentiment && Object.keys(queueStats.bySentiment).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(queueStats.bySentiment).map(([sentiment, count]) => (
              <span key={sentiment} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                {sentiment}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reply from Queue */}
        <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💬</span>
            <h3 className="text-lg font-semibold text-gray-900">Reply from Queue</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Reply to the next batch of unreplied comments already in the queue.
            No new scraping — just processes what&apos;s there.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-600">Replies:</label>
            <select
              value={replyLimit}
              onChange={(e) => setReplyLimit(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50 (max)</option>
            </select>
          </div>
          <button
            onClick={() => runOperation('reply_queue')}
            disabled={running !== null || (queueStats?.unreplied || 0) === 0}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running === 'reply_queue' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Replying... ({elapsedSeconds}s)
              </span>
            ) : (
              `Reply to ${Math.min(replyLimit, queueStats?.unreplied || 0)} Comments`
            )}
          </button>
        </div>

        {/* Full Scrape + Reply */}
        <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔄</span>
            <h3 className="text-lg font-semibold text-gray-900">Fresh Scrape + Reply</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Full pipeline: purge stale comments (&gt;48hrs), scrape fresh comments
            from Instagram, then auto-reply to new ones. Takes 2-4 minutes.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-amber-700">
              Purges unreplied comments older than 48 hours before scraping fresh ones.
            </p>
          </div>
          <button
            onClick={() => runOperation('scrape_and_reply')}
            disabled={running !== null}
            className="w-full py-3 px-4 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running === 'scrape_and_reply' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Scraping &amp; Replying... ({elapsedSeconds}s)
              </span>
            ) : (
              'Scrape Fresh + Auto-Reply'
            )}
          </button>
        </div>
      </div>

      {/* Purge Stale Button */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Purge Stale Comments</h3>
            <p className="text-xs text-gray-400 mt-1">
              Clear unreplied comments older than 48 hours (too old for Instagram to accept replies).
            </p>
          </div>
          <button
            onClick={() => runOperation('purge_stale')}
            disabled={running !== null}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {running === 'purge_stale' ? 'Purging...' : 'Purge Stale'}
          </button>
        </div>
      </div>

      {/* Live Progress Log */}
      {(progressLog.length > 0 || running) && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              {running && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
              {running ? 'Running...' : 'Complete'}
              {running && <span className="text-gray-500 text-xs">({elapsedSeconds}s)</span>}
            </h3>
            {!running && progressLog.length > 0 && (
              <button onClick={() => setProgressLog([])} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
            )}
          </div>
          <div className="font-mono text-xs text-green-400 space-y-1 max-h-48 overflow-y-auto">
            {progressLog.map((line, i) => (
              <div key={i} className={line.includes('Error') ? 'text-red-400' : line.includes('Done') ? 'text-green-300 font-bold' : ''}>
                {line}
              </div>
            ))}
            {running && <div className="text-gray-500 animate-pulse">▌</div>}
          </div>
        </div>
      )}

      {/* Detailed Result */}
      {result && !running && (
        <details className="rounded-xl border border-gray-200 bg-white">
          <summary className={`p-4 cursor-pointer text-sm font-medium ${result.data.error ? 'text-red-600' : 'text-green-700'}`}>
            {result.data.error ? '❌ Error details' : '✅ Full result details'} — click to expand
          </summary>
          <pre className="text-xs text-gray-600 p-4 pt-0 whitespace-pre-wrap overflow-x-auto max-h-60">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/* ──────────────── Sub-components ──────────────── */

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    food: 'bg-orange-100 text-orange-700',
    outdoors: 'bg-green-100 text-green-700',
    travel: 'bg-blue-100 text-blue-700',
    rescue: 'bg-pink-100 text-pink-700',
    watchlist: 'bg-purple-100 text-purple-700',
    story_repost: 'bg-yellow-100 text-yellow-700',
    general: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[category] || styles.general}`}>
      {category === 'story_repost' ? 'Story Repost' : category}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };
  return (
    <div className={`rounded-lg border p-4 text-center ${colors[color] || colors.gray}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-75">{label}</p>
    </div>
  );
}

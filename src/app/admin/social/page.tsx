'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ──────────────── Types ──────────────── */

interface EventDraft {
  id: string;
  name: string;
  cityName: string;
  citySlug: string;
  venueName: string | null;
  venueAddress: string | null;
  startDate: string;
  endDate: string | null;
  tags: string[];
  sourceHandle: string | null;
  sourcePostUrl: string | null;
  isFeatured: boolean;
  isFree: boolean;
  description: string | null;
  caption: string;
  imageUrl: string | null;
  creativeUrl: string;
  engagementReplies: string[];
  alreadyPosted: boolean;
}

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

interface PerformanceStats {
  totalPublished: number;
  totalFailed: number;
  avgLikes: number;
  avgComments: number;
  contentRemaining: number;
}

type TabId = 'events' | 'engagement' | 'outreach' | 'invitations' | 'comments' | 'performance';

/* ──────────────── Helpers ──────────────── */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

/* ──────────────── Component ──────────────── */

export default function SocialCommandCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const [loading, setLoading] = useState(true);

  // Data
  const [eventDrafts, setEventDrafts] = useState<EventDraft[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [outreach, setOutreach] = useState<OutreachItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);

  // UI state
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ id: string; success: boolean; permalink?: string; error?: string } | null>(null);
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, oppRes, outRes, invRes, comRes, perfRes] = await Promise.all([
        fetch('/api/admin/social?type=event-drafts').then(r => r.json()),
        fetch('/api/admin/social?type=opportunities').then(r => r.json()),
        fetch('/api/admin/social?type=outreach').then(r => r.json()),
        fetch('/api/admin/social?type=invitations').then(r => r.json()),
        fetch('/api/admin/social?type=comments').then(r => r.json()),
        fetch('/api/admin/social?type=performance').then(r => r.json()),
      ]);
      setEventDrafts(evRes.drafts || []);
      setOpportunities(oppRes.opportunities || []);
      setOutreach(outRes.outreach || []);
      setInvitations(invRes.invitations || []);
      setComments(comRes.comments || []);
      setPosts(perfRes.posts || []);
      setPerfStats(perfRes.stats || null);
    } catch (err) {
      console.error('Failed to fetch social data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* --- Actions --- */

  const publishPost = async (draft: EventDraft) => {
    setPublishing(draft.id);
    setPublishResult(null);
    try {
      // Use the full creative URL (absolute) for Instagram to fetch
      const creativeImageUrl = `https://pawcities.com${draft.creativeUrl}`;
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          caption: draft.caption,
          imageUrl: creativeImageUrl,
          headline: draft.name,
          city: draft.citySlug,
          eventId: draft.id,
        }),
      });
      const data = await res.json();
      setPublishResult({ id: draft.id, success: data.success, permalink: data.permalink, error: data.error });
      if (data.success) {
        setEventDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, alreadyPosted: true } : d));
      }
    } catch (err) {
      setPublishResult({ id: draft.id, success: false, error: String(err) });
    } finally {
      setPublishing(null);
    }
  };

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

  /* --- Counts --- */
  const pendingEvents = eventDrafts.filter(d => !d.alreadyPosted);
  const pendingOpps = opportunities.filter(o => o.status === 'new');
  const unrepliedComments = comments.filter(c => !c.replied);

  const tabs: { id: TabId; label: string; count?: number; icon: string }[] = [
    { id: 'events', label: 'Event Posts', count: pendingEvents.length, icon: '📅' },
    { id: 'engagement', label: 'Engagement', count: pendingOpps.length, icon: '💬' },
    { id: 'outreach', label: 'Outreach', count: outreach.length, icon: '📣' },
    { id: 'invitations', label: 'Invitations', count: invitations.length, icon: '🤝' },
    { id: 'comments', label: 'Comments', count: unrepliedComments.length, icon: '💭' },
    { id: 'performance', label: 'Performance', icon: '📊' },
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
            {pendingEvents.length} event posts ready &middot; {pendingOpps.length} engagement opportunities &middot; {unrepliedComments.length} unreplied comments
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

      {/* ═══════ EVENT POSTS TAB ═══════ */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Step 1: Engage with the source</strong> — Reply to the original post where we found each event. This builds relationships and drives traffic.
              <br /><strong>Step 2: Post your own</strong> — Publish a branded creative with the city skyline + event details to your feed.
            </p>
          </div>

          {pendingEvents.length === 0 ? (
            <EmptyState icon="📅" message="All events have been posted! Add more events to generate new post drafts." />
          ) : pendingEvents.map(draft => (
            <div key={draft.id} className={`bg-white rounded-xl border ${draft.isFeatured ? 'border-orange-300 ring-1 ring-orange-100' : 'border-gray-200'} overflow-hidden`}>
              {/* Event header bar */}
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {draft.isFeatured && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Featured</span>}
                  {draft.isFree && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Free</span>}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{draft.cityName}</span>
                  <span className="text-xs text-gray-400">{formatDate(draft.startDate)}{draft.endDate ? ` - ${formatDate(draft.endDate)}` : ''}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{draft.name}</h3>
                {draft.venueName && <p className="text-sm text-gray-600 mt-0.5">📍 {draft.venueName}{draft.venueAddress ? `, ${draft.venueAddress}` : ''}</p>}
                {draft.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {draft.tags.map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── SECTION 1: Engage with Source (Primary) ── */}
              {draft.sourceHandle && draft.engagementReplies.length > 0 && (
                <div className="bg-purple-50 border-t border-b border-purple-200 px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-purple-800">Step 1: Reply to {draft.sourceHandle}</span>
                    <a
                      href={draft.sourcePostUrl || `https://instagram.com/${draft.sourceHandle.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-600 border border-purple-300 px-2.5 py-1 rounded-lg hover:bg-purple-100 font-medium"
                    >
                      Open Post →
                    </a>
                  </div>
                  <div className="space-y-2">
                    {draft.engagementReplies.map((reply, i) => (
                      <div key={i} className="bg-white border border-purple-200 rounded-lg p-3 flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{reply}</p>
                        </div>
                        <button
                          onClick={() => handleCopy(reply, `reply-${draft.id}-${i}`)}
                          className="text-xs text-purple-600 border border-purple-300 px-2.5 py-1 rounded hover:bg-purple-50 whitespace-nowrap font-medium"
                        >
                          {copiedId === `reply-${draft.id}-${i}` ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No source handle — show note */}
              {!draft.sourceHandle && (
                <div className="bg-gray-50 border-t border-b border-gray-200 px-5 py-3">
                  <p className="text-xs text-gray-500">No source handle — this event was added manually. Skip to posting your own creative below.</p>
                </div>
              )}

              {/* ── SECTION 2: Post Your Own (Secondary) ── */}
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  {draft.sourceHandle ? 'Step 2: ' : ''}Post to @thepawcities
                </p>

                <div className="flex gap-4">
                  {/* Creative preview */}
                  <div className="w-40 h-40 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
                    <img
                      src={draft.creativeUrl}
                      alt={`Creative for ${draft.name}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Caption preview */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-500">Caption:</p>
                        <button onClick={() => handleCopy(draft.caption, `caption-${draft.id}`)} className="text-xs text-orange-600 hover:underline">
                          {copiedId === `caption-${draft.id}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {expandedCaption === draft.id ? draft.caption : draft.caption.slice(0, 150) + (draft.caption.length > 150 ? '...' : '')}
                      </p>
                      {draft.caption.length > 150 && (
                        <button onClick={() => setExpandedCaption(expandedCaption === draft.id ? null : draft.id)} className="text-xs text-orange-500 mt-1">
                          {expandedCaption === draft.id ? 'Less' : 'More'}
                        </button>
                      )}
                    </div>

                    {/* Publish actions */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => publishPost(draft)}
                        disabled={publishing === draft.id}
                        className="flex items-center gap-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {publishing === draft.id ? (
                          <><span className="animate-spin">⏳</span> Publishing...</>
                        ) : (
                          <>📸 Publish</>
                        )}
                      </button>
                      <a
                        href={draft.creativeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
                      >
                        Preview Creative
                      </a>
                    </div>
                  </div>
                </div>

                {/* Publish result */}
                {publishResult?.id === draft.id && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${publishResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {publishResult.success ? (
                      <>✅ Published! <a href={publishResult.permalink} target="_blank" rel="noopener noreferrer" className="underline font-medium">View on Instagram</a></>
                    ) : (
                      <>❌ Failed: {publishResult.error}</>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
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
          ) : outreach.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{item.handle}</span>
                <span className="text-xs text-gray-400">{item.cityName}</span>
                <span className="text-xs text-gray-400">{formatDate(item.startDate)}</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-3">Re: {item.eventName}</h3>

              <div className="space-y-2 mb-3">
                {item.suggestedComments.map((comment, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-3">
                    <div className="flex-1">
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

              <div className="flex items-center gap-3">
                {item.sourcePostUrl ? (
                  <a href={item.sourcePostUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:underline font-medium">
                    Open Source Post →
                  </a>
                ) : (
                  <a href={`https://instagram.com/${item.handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:underline font-medium">
                    View Profile →
                  </a>
                )}
              </div>
            </div>
          ))}
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

          {invitations.length === 0 ? (
            <EmptyState icon="🤝" message="No venues to invite. Events without venue names won't appear here." />
          ) : invitations.map(inv => (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{inv.cityName}</span>
                <span className="text-xs text-gray-400">{formatDate(inv.startDate)}</span>
                {inv.sourceHandle && <span className="text-xs text-purple-500">{inv.sourceHandle}</span>}
              </div>
              <h3 className="font-medium text-gray-900 mb-1">{inv.venueName}</h3>
              <p className="text-sm text-gray-500 mb-3">Hosting: {inv.eventName}</p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-amber-700">DM Template:</p>
                  <button onClick={() => handleCopy(inv.dmTemplate, `inv-${inv.id}`)} className="text-xs text-amber-600 hover:underline">
                    {copiedId === `inv-${inv.id}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-amber-800 whitespace-pre-line">{inv.dmTemplate}</p>
              </div>

              {inv.sourceHandle && (
                <a href={`https://instagram.com/${inv.sourceHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-500 hover:underline">
                  Open Instagram Profile →
                </a>
              )}
            </div>
          ))}
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

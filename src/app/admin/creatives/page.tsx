'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreativeItem {
  id: string;
  content_type: string;
  content_index: number | null;
  event_id: string | null;
  narrator: string;
  city: string;
  headline: string;
  caption: string;
  image_url: string | null;
  image_prompt: string;
  format: string;
  status: string;
  scheduled_for: string | null;
  posted_at: string | null;
  rejection_reason: string | null;
  error_message: string | null;
  generation_model: string | null;
  created_at: string;
}

interface StatusCounts {
  generating: number;
  pending_review: number;
  approved: number;
  rejected: number;
  posted: number;
  failed: number;
}

const CITY_NAMES: Record<string, string> = {
  paris: 'Paris', geneva: 'Geneva', london: 'London', barcelona: 'Barcelona',
  losangeles: 'Los Angeles', nyc: 'New York', sydney: 'Sydney', tokyo: 'Tokyo',
};

const NARRATOR_LABELS: Record<string, { name: string; emoji: string; color: string }> = {
  buster: { name: 'Buster', emoji: '🐕', color: 'bg-amber-100 text-amber-700' },
  marley: { name: 'Marley', emoji: '🐩', color: 'bg-blue-100 text-blue-700' },
  both: { name: 'Both', emoji: '🐾', color: 'bg-purple-100 text-purple-700' },
};

const STATUS_STYLES: Record<string, { label: string; dot: string; bg: string }> = {
  generating: { label: 'Generating', dot: 'bg-yellow-400', bg: 'bg-yellow-50 text-yellow-700' },
  pending_review: { label: 'Review', dot: 'bg-orange-400', bg: 'bg-orange-50 text-orange-700' },
  approved: { label: 'Approved', dot: 'bg-green-500', bg: 'bg-green-50 text-green-700' },
  rejected: { label: 'Rejected', dot: 'bg-red-400', bg: 'bg-red-50 text-red-700' },
  posted: { label: 'Posted', dot: 'bg-blue-500', bg: 'bg-blue-50 text-blue-700' },
  failed: { label: 'Failed', dot: 'bg-red-600', bg: 'bg-red-50 text-red-700' },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CreativeReviewPage() {
  const [items, setItems] = useState<CreativeItem[]>([]);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');
  const [generating, setGenerating] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<{ id: string; caption: string } | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (filter && filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/admin/creatives?${params}`);
      const json = await res.json();
      setItems(json.items || []);
      setCounts(json.counts || null);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Generate batch ────────────────────────────────────────────────────────

  const handleGenerateBatch = async (count: number) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_batch', count }),
      });
      const json = await res.json();
      if (json.success) {
        setFilter('pending_review');
        fetchItems();
      }
    } catch {
      // fail silently
    } finally {
      setGenerating(false);
    }
  };

  // ── Approve / Reject / Edit ───────────────────────────────────────────────

  const handleAction = async (id: string, action: string, extra?: Record<string, string>) => {
    setActioningId(id);
    try {
      await fetch('/api/admin/creatives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      fetchItems();
    } catch {
      // fail silently
    } finally {
      setActioningId(null);
    }
  };

  const handleApproveAll = async () => {
    setGenerating(true);
    try {
      await fetch('/api/admin/creatives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'all', action: 'approve_all' }),
      });
      fetchItems();
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveCaption = async () => {
    if (!editingCaption) return;
    await handleAction(editingCaption.id, 'edit', { caption: editingCaption.caption });
    setEditingCaption(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const totalPending = counts?.pending_review || 0;
  const totalApproved = counts?.approved || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Command Center</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Creative Review</h1>
          <p className="text-gray-500 text-sm">
            {totalPending > 0
              ? `${totalPending} creative${totalPending !== 1 ? 's' : ''} waiting for review`
              : totalApproved > 0
              ? `${totalApproved} approved and ready to post`
              : 'Generate your first batch of mascot content'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalPending > 1 && (
            <button
              onClick={handleApproveAll}
              disabled={generating}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Approve All ({totalPending})
            </button>
          )}
          <button
            onClick={() => handleGenerateBatch(7)}
            disabled={generating}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <><span className="animate-spin">⟳</span> Generating...</>
            ) : (
              <>✨ Generate 7-Day Batch</>
            )}
          </button>
        </div>
      </div>

      {/* Status Counts */}
      {counts && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(STATUS_STYLES).map(([key, style]) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`p-3 rounded-lg border text-center transition-all ${
                filter === key ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-xl font-bold text-gray-900">{counts[key as keyof StatusCounts] || 0}</p>
              <p className="text-xs text-gray-500">{style.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-gray-400">Loading creative queue...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-4xl mb-3">🎨</p>
          <p className="text-gray-600 font-medium mb-1">No creatives yet</p>
          <p className="text-gray-400 text-sm mb-4">
            Click &quot;Generate 7-Day Batch&quot; to create your first week of Buster &amp; Marley content
          </p>
        </div>
      ) : (
        /* Creative Cards */
        <div className="space-y-3">
          {items.map(item => {
            const narratorInfo = NARRATOR_LABELS[item.narrator] || NARRATOR_LABELS.both;
            const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.pending_review;
            const isExpanded = expandedId === item.id;
            const isActioning = actioningId === item.id;

            return (
              <div key={item.id} className="bg-white rounded-xl border hover:shadow-sm transition-shadow overflow-hidden">
                {/* Main row */}
                <div className="p-4 flex items-start gap-4">
                  {/* Image preview or placeholder */}
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.headline} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{narratorInfo.emoji}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${narratorInfo.color}`}>
                        {narratorInfo.emoji} {narratorInfo.name}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{CITY_NAMES[item.city] || item.city}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg}`}>
                        {statusStyle.label}
                      </span>
                      {item.scheduled_for && (
                        <>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">
                            📅 {new Date(item.scheduled_for + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 truncate">{item.headline}</p>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{item.caption.split('\n')[0]}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'pending_review' && (
                      <>
                        <button
                          onClick={() => handleAction(item.id, 'approve')}
                          disabled={isActioning}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {isActioning ? '...' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'reject')}
                          disabled={isActioning}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          ✗
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    {/* Caption preview / edit */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Caption</p>
                        {item.status === 'pending_review' && !editingCaption && (
                          <button
                            onClick={() => setEditingCaption({ id: item.id, caption: item.caption })}
                            className="text-xs text-orange-600 hover:text-orange-700"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {editingCaption?.id === item.id ? (
                        <div>
                          <textarea
                            value={editingCaption.caption}
                            onChange={e => setEditingCaption({ ...editingCaption, caption: e.target.value })}
                            className="w-full h-40 p-3 text-sm border rounded-lg resize-y font-mono"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={handleSaveCaption}
                              className="px-3 py-1 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCaption(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border max-h-48 overflow-y-auto">
                          {item.caption}
                        </pre>
                      )}
                    </div>

                    {/* Image prompt */}
                    {item.image_prompt && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">DALL-E Prompt</p>
                        <div className="bg-white rounded-lg border p-3 relative">
                          <p className="text-sm text-gray-600 italic">{item.image_prompt}</p>
                          <button
                            onClick={() => navigator.clipboard.writeText(item.image_prompt)}
                            className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600 bg-white px-2 py-1 rounded border"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Format: {item.format}</span>
                      <span>Model: {item.generation_model || 'TBD'}</span>
                      <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
                      {item.rejection_reason && (
                        <span className="text-red-500">Reason: {item.rejection_reason}</span>
                      )}
                      {item.error_message && (
                        <span className="text-red-500">Error: {item.error_message}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface EventRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  source: string;
  start_date: string;
  end_date: string | null;
  venue_name: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  is_featured: boolean;
  is_free: boolean;
  discovery_score: number;
  tags: string[];
  source_handle: string | null;
  external_url: string | null;
  created_at: string;
  cities: { slug: string; name: string } | null;
  description?: string | null;
  venue_address?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  image_url?: string | null;
}

interface EventsResponse {
  events: EventRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function AdminEventsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('PENDING');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (event: EventRow) => {
    setEditing(event);
    setEditForm({
      name: event.name || '',
      description: event.description || '',
      venueName: event.venue_name || '',
      venueAddress: event.venue_address || '',
      externalUrl: event.external_url || '',
      startDate: event.start_date || '',
      startTime: (event.start_time || '').slice(0, 5),
      endTime: (event.end_time || '').slice(0, 5),
      tags: (event.tags || []).join(', '),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          name: editForm.name,
          description: editForm.description || null,
          venueName: editForm.venueName || null,
          venueAddress: editForm.venueAddress || null,
          externalUrl: editForm.externalUrl || null,
          startDate: editForm.startDate,
          startTime: editForm.startTime || null,
          endTime: editForm.endTime || null,
          tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      if (!response.ok) {
        const d = await response.json();
        alert(d.error || 'Save failed');
      } else {
        setEditing(null);
        await fetchEvents();
      }
    } catch {
      alert('Save failed');
    } finally {
      setEditSaving(false);
    }
  };

  const fetchEvents = async (p?: number) => {
    try {
      setLoading(true);
      const currentPage = p ?? page;
      const url = new URL('/api/admin/events', window.location.origin);
      if (status !== 'all') {
        url.searchParams.set('status', status);
      }
      url.searchParams.set('page', String(currentPage));

      const response = await fetch(url.toString());
      if (response.status === 401) {
        router.push('/login?redirect=/admin/events');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch events');
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. You may need to log in first.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchEvents(1);
  }, [status]);

  useEffect(() => {
    fetchEvents();
  }, [page]);

  const handleAction = async (eventId: string, action: string, reviewNotes?: string) => {
    setActionLoading(eventId);
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNotes }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Action failed');
      } else {
        // Refresh the list
        await fetchEvents();
      }
    } catch {
      alert('Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'All', value: 'all' },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isPastEvent = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  const getStatusBadge = (eventStatus: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      APPROVED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-600',
    };
    return styles[eventStatus] || 'bg-gray-100 text-gray-700';
  };

  const getSourceBadge = (source: string) => {
    const styles: Record<string, { bg: string; label: string }> = {
      user_submission: { bg: 'bg-blue-100 text-blue-700', label: 'User' },
      discovery_agent: { bg: 'bg-purple-100 text-purple-700', label: 'Agent' },
      admin: { bg: 'bg-gray-100 text-gray-600', label: 'Admin' },
    };
    return styles[source] || { bg: 'bg-gray-100 text-gray-600', label: source };
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Calendar</h1>
          <p className="text-gray-600">
            Review submitted events and manage the event calendar
          </p>
        </div>
        {data && (
          <div className="text-sm text-gray-500">
            {data.pagination.total} event{data.pagination.total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Status Tabs */}
      <div className="bg-white rounded-xl border p-2">
        <div className="flex gap-2 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors relative ${
                status === tab.value
                  ? 'border-b-orange-500 text-orange-600'
                  : 'border-b-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.value === 'PENDING' && data && status === 'PENDING' && data.pagination.total > 0 && (
                <span className="ml-2 inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  {data.pagination.total}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="divide-y">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events List */}
      {!loading && data && (
        <>
          {data.events.length > 0 ? (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="divide-y">
                {data.events.map((event) => {
                  const source = getSourceBadge(event.source);
                  const past = isPastEvent(event.start_date);

                  return (
                    <div
                      key={event.id}
                      className={`p-4 transition-colors ${past ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Event name + badges */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 truncate max-w-md">
                              {event.name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(event.status)}`}>
                              {event.status}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${source.bg}`}>
                              {source.label}
                            </span>
                            {event.is_featured && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                Featured
                              </span>
                            )}
                            {event.is_free && (
                              <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs font-medium">
                                Free
                              </span>
                            )}
                            {past && (
                              <span className="px-2 py-0.5 bg-red-50 text-red-500 rounded-full text-xs font-medium">
                                Past
                              </span>
                            )}
                          </div>

                          {/* Event details grid */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm text-gray-600">
                            <div>
                              <span className="text-gray-400 text-xs">Date</span>
                              <p className="font-medium">{formatDate(event.start_date)}</p>
                              {event.end_date && event.end_date !== event.start_date && (
                                <p className="text-xs text-gray-400">to {formatDate(event.end_date)}</p>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-400 text-xs">City</span>
                              <p>{event.cities?.name || 'Unknown'}</p>
                            </div>
                            <div>
                              <span className="text-gray-400 text-xs">Venue</span>
                              <p className="truncate">{event.venue_name || '—'}</p>
                            </div>
                            <div>
                              <span className="text-gray-400 text-xs">Source</span>
                              <p className="truncate">
                                {event.source === 'user_submission'
                                  ? event.submitter_name || event.submitter_email || 'Anonymous'
                                  : event.source_handle || 'Admin'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-400 text-xs">Score</span>
                              <p>{event.discovery_score > 0 ? `${event.discovery_score}/100` : '—'}</p>
                            </div>
                          </div>

                          {/* Tags */}
                          {event.tags && event.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {event.tags.slice(0, 5).map((tag) => (
                                <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                              {event.tags.length > 5 && (
                                <span className="text-xs text-gray-400">+{event.tags.length - 5} more</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {event.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleAction(event.id, 'approve')}
                                disabled={actionLoading === event.id}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                Approve
                              </button>
                              {(event.tags || []).includes('recurring') && (
                                <button
                                  onClick={() => handleAction(event.id, 'approve_series')}
                                  disabled={actionLoading === event.id}
                                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                                  title="Approve every pending occurrence of this recurring event"
                                >
                                  Approve series
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const notes = prompt('Rejection reason (optional):');
                                  handleAction(event.id, 'reject', notes || undefined);
                                }}
                                disabled={actionLoading === event.id}
                                className="px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {event.status === 'APPROVED' && (
                            <>
                              <button
                                onClick={() => handleAction(event.id, event.is_featured ? 'unfeature' : 'feature')}
                                disabled={actionLoading === event.id}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                                  event.is_featured
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                    : 'bg-white border border-amber-300 text-amber-600 hover:bg-amber-50'
                                }`}
                              >
                                {event.is_featured ? 'Unfeature' : 'Feature'}
                              </button>
                              <button
                                onClick={() => handleAction(event.id, 'cancel')}
                                disabled={actionLoading === event.id}
                                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEdit(event)}
                            disabled={actionLoading === event.id}
                            className="px-3 py-1.5 bg-white border border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors"
                          >
                            Edit
                          </button>
                          {event.status === 'APPROVED' && (
                            <a
                              href={`/events/${event.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-sm text-center hover:bg-gray-50 transition-colors"
                            >
                              View live
                            </a>
                          )}
                          {event.external_url && (
                            <a
                              href={event.external_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-sm text-center hover:bg-gray-50 transition-colors"
                            >
                              Link
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border p-12 text-center">
              <p className="text-gray-500 mb-2">No events found</p>
              <p className="text-sm text-gray-400">
                {status === 'PENDING'
                  ? 'No events waiting for review'
                  : `No ${status.toLowerCase()} events at this time`}
              </p>
            </div>
          )}

          {/* Pagination */}
          {data.events.length > 0 && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-gray-600">
                Showing {(data.pagination.page - 1) * data.pagination.limit + 1}–{Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total} events
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="px-2.5 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  First
                </button>
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1.5 text-gray-700 font-medium">
                  Page {data.pagination.page} of {data.pagination.pages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.pagination.pages}
                  className="px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
                <button
                  onClick={() => setPage(data.pagination.pages)}
                  disabled={page >= data.pagination.pages}
                  className="px-2.5 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit modal — full view/edit without leaving the queue */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit event</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <input value={editForm.venueName} onChange={e => setEditForm(f => ({ ...f, venueName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input value={editForm.venueAddress} onChange={e => setEditForm(f => ({ ...f, venueAddress: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input type="time" value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input type="time" value={editForm.endTime} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event link</label>
                <input value={editForm.externalUrl} onChange={e => setEditForm(f => ({ ...f, externalUrl: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                <input value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveEdit} disabled={editSaving || !editForm.name || !editForm.startDate} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

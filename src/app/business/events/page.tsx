'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface BusinessEvent {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  external_url: string | null;
  status: string;
  is_free: boolean;
  created_at: string;
}

interface EstablishmentInfo {
  id: string;
  name: string;
  address: string | null;
  city: { slug: string; name: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REJECTED: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function BusinessEventsPage() {
  const [establishment, setEstablishment] = useState<EstablishmentInfo | null>(null);
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: '',
    startTime: '',
    endTime: '',
    externalUrl: '',
    isFree: true,
    repeatWeeks: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/business/events');
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || 'Failed to load');
        return;
      }
      setEstablishment(data.establishment);
      setEvents(data.events || []);
    } catch {
      setLoadError('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate) {
      setFormError('Event name and date are required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/business/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          startDate: form.startDate,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          externalUrl: form.externalUrl.trim() || null,
          isFree: form.isFree,
          repeatWeeks: form.repeatWeeks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to submit event');
        return;
      }
      setSuccess(data.message || 'Event submitted for review!');
      setShowForm(false);
      setForm({ name: '', description: '', startDate: '', startTime: '', endTime: '', externalUrl: '', isFree: true, repeatWeeks: 1 });
      load();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading events...</div>;
  }

  if (loadError) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800">
        {loadError === 'No approved business claim found' ? (
          <>
            You need an approved business listing to manage events.{' '}
            <Link href="/business/claim" className="underline font-medium">Claim your business →</Link>
          </>
        ) : (
          loadError
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          {establishment && (
            <p className="text-sm text-gray-500 mt-1">
              Hosted at {establishment.name}
              {establishment.city ? ` · ${establishment.city.name}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setSuccess(null); }}
          className="px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {success}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            New event at {establishment?.name}
          </h2>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Yappy Hour, Puppy Social, Adoption Day"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="What should dog owners know? Treats, water bowls, off-leash area..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link (tickets, RSVP, or more info)
              </label>
              <input
                type="url"
                value={form.externalUrl}
                onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isFree}
                  onChange={e => setForm(f => ({ ...f, isFree: e.target.checked }))}
                  className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                />
                Free to attend
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Repeats weekly for
                <select
                  value={form.repeatWeeks}
                  onChange={e => setForm(f => ({ ...f, repeatWeeks: parseInt(e.target.value, 10) }))}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value={1}>just this once</option>
                  {[2, 3, 4, 6, 8, 12].map(n => (
                    <option key={n} value={n}>{n} weeks</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Submitting...' : 'Submit for review'}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Events are reviewed before appearing on your city page — usually within a day.
              </p>
            </div>
          </form>
        </div>
      )}

      {events.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <span className="text-5xl block mb-4">📅</span>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No events yet</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Events are one of the best ways to bring dog owners through your door — and they
            get featured on the {establishment?.city?.name || 'city'} page and in the weekly digest.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            Create your first event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{ev.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[ev.status] || 'bg-gray-100 text-gray-500'}`}>
                    {ev.status.charAt(0) + ev.status.slice(1).toLowerCase()}
                  </span>
                  {ev.is_free && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Free</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(ev.start_date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                  })}
                  {ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ''}
                  {ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ''}
                </p>
                {ev.description && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{ev.description}</p>
                )}
              </div>
              {ev.external_url && (
                <a
                  href={ev.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-600 hover:underline shrink-0"
                >
                  Link ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

const CITY_OPTIONS = [
  { slug: 'atlanta', name: 'Atlanta' },
  { slug: 'geneva', name: 'Geneva' },
  { slug: 'paris', name: 'Paris' },
  { slug: 'london', name: 'London' },
  { slug: 'losangeles', name: 'Los Angeles' },
  { slug: 'newyork', name: 'New York City' },
  { slug: 'barcelona', name: 'Barcelona' },
  { slug: 'sydney', name: 'Sydney' },
  { slug: 'tokyo', name: 'Tokyo' },
];

export default function SubmitEventPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    description: '',
    venueName: '',
    venueAddress: '',
    externalUrl: '',
    instagramHandle: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    citySlug: '',
    imageUrl: '',
    isFree: false,
    submitterName: '',
    submitterEmail: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Pre-fill from logged-in user
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        submitterName: prev.submitterName || user.user_metadata?.name || '',
        submitterEmail: prev.submitterEmail || user.email || '',
      }));
    }
  }, [user]);

  // Minimum date is today
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Every event needs an actionable contact: link, Instagram, or venue
    if (!form.externalUrl.trim() && !form.instagramHandle.trim() && !form.venueName.trim()) {
      setResult({
        success: false,
        message: 'Please add at least one way for people to act on this event: an event link, an Instagram handle, or the venue name.',
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: data.message || 'Event submitted successfully!',
        });
        // Reset form
        setForm(prev => ({
          ...prev,
          name: '',
          description: '',
          venueName: '',
          venueAddress: '',
          externalUrl: '',
          startDate: '',
          endDate: '',
          startTime: '',
          endTime: '',
          citySlug: '',
          imageUrl: '',
          isFree: false,
        }));
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to submit event',
        });
      }
    } catch {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-orange-600 hover:text-orange-700 mb-2 inline-block">
            &larr; Back to Paw Cities
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Submit a Dog-Friendly Event</h1>
          <p className="text-gray-600 mt-1">
            Know about an upcoming dog-friendly event? Share it with the Paw Cities community!
            Events are reviewed by our team before they appear on the calendar.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Success / Error Message */}
        {result && (
          <div className={`mb-6 p-4 rounded-xl border ${
            result.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <p className="font-medium">{result.success ? 'Submitted!' : 'Error'}</p>
            <p className="text-sm mt-1">{result.message}</p>
            {result.success && (
              <p className="text-sm mt-2">
                Want to submit another? Fill out the form below.
              </p>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Details Card */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Bark in the Park — Dodger Stadium"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Tell us about the event — what to expect, what to bring, any dog requirements..."
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  maxLength={5000}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Link
                </label>
                <input
                  type="url"
                  value={form.externalUrl}
                  onChange={(e) => updateField('externalUrl', e.target.value)}
                  placeholder="https://example.com/event-page"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Link to tickets, registration, or event details</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instagram Handle
                </label>
                <input
                  type="text"
                  value={form.instagramHandle}
                  onChange={(e) => updateField('instagramHandle', e.target.value)}
                  placeholder="@organizer_or_venue"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  The organizer&apos;s or venue&apos;s Instagram — so attendees can reach out.
                  <span className="text-orange-600"> Every event needs at least one of: link, Instagram, or venue name.</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Image URL
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => updateField('imageUrl', e.target.value)}
                  placeholder="https://example.com/event-poster.jpg"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Optional — link to an event poster or photo</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isFree}
                  onChange={(e) => updateField('isFree', e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">This is a free event</span>
              </label>
            </div>
          </div>

          {/* Date & Location Card */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">When &amp; Where</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateField('startDate', e.target.value)}
                    min={today}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => updateField('endDate', e.target.value)}
                    min={form.startDate || today}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank for single-day events</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => updateField('startTime', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => updateField('endTime', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <select
                  value={form.citySlug}
                  onChange={(e) => updateField('citySlug', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                >
                  <option value="">Select a city</option>
                  {CITY_OPTIONS.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Venue Name
                  </label>
                  <input
                    type="text"
                    value={form.venueName}
                    onChange={(e) => updateField('venueName', e.target.value)}
                    placeholder="e.g., Dodger Stadium"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    maxLength={255}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Venue Address
                  </label>
                  <input
                    type="text"
                    value={form.venueAddress}
                    onChange={(e) => updateField('venueAddress', e.target.value)}
                    placeholder="e.g., 1000 Vin Scully Ave, Los Angeles, CA"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Your Info Card */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Information</h2>
            <p className="text-sm text-gray-500 mb-4">
              So we can follow up if we have questions about the event.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={form.submitterName}
                  onChange={(e) => updateField('submitterName', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email *
                </label>
                <input
                  type="email"
                  value={form.submitterEmail}
                  onChange={(e) => updateField('submitterEmail', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Event'}
            </button>
            <Link
              href="/"
              className="px-8 py-3 text-gray-600 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 rounded-xl border border-blue-100 p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How Event Submissions Work</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>1. Submit your event using the form above</p>
            <p>2. Our team reviews the submission (usually within 1-2 business days)</p>
            <p>3. Once approved, your event appears on the Paw Cities calendar for that city</p>
            <p>4. The event is automatically removed after the event date passes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewDogPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    breed: '',
    birthDate: '',
    size: 'MEDIUM',
    personality: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Dog name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/dogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          breed: form.breed.trim() || null,
          birthDate: form.birthDate || null,
          size: form.size,
          personality: form.personality.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add dog'); return; }
      router.push('/profile/dogs');
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/profile/dogs" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add a Dog</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="What's your dog's name?" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
            <input type="text" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} placeholder="e.g., Golden Retriever, Mixed breed..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
              <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
              <select value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none">
                <option value="SMALL">Small (under 10kg / 22lbs)</option>
                <option value="MEDIUM">Medium (10-25kg / 22-55lbs)</option>
                <option value="LARGE">Large (25-45kg / 55-100lbs)</option>
                <option value="XLARGE">Extra Large (45kg+ / 100lbs+)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
            <textarea value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} rows={3} placeholder="Tell us about your dog's personality... Friendly? Playful? Shy with strangers?" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {saving ? 'Adding...' : 'Add Dog'}
            </button>
            <Link href="/profile/dogs" className="px-6 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

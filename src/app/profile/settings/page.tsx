'use client';

import { useState, useEffect } from 'react';
import { CITIES } from '@/lib/cities-config';

const cities = Object.values(CITIES);

export default function SettingsPage() {
  const [profile, setProfile] = useState<{ name: string; language: string; home_city: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ language: 'en', homeCity: '' });

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setProfile(data.user);
          setForm({ language: data.user.language || 'en', homeCity: data.user.home_city || '' });
        }
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: form.language, homeCity: form.homeCity || null }),
      });
      if (!res.ok) { setError('Failed to save'); return; }
      setSuccess('Settings saved!');
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading settings...</div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
          <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none">
            <option value="en">English</option>
            <option value="fr">French</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Home City</label>
          <select value={form.homeCity} onChange={e => setForm(f => ({ ...f, homeCity: e.target.value }))} className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none">
            <option value="">Select a city</option>
            {cities.map(city => <option key={city.slug} value={city.slug}>{city.name}, {city.country}</option>)}
          </select>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

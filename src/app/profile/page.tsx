'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CITIES } from '@/lib/cities-config';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  language: string;
  home_city: string | null;
  role: string;
  created_at: string;
}

interface Stats {
  dogs: number;
  reviews: number;
  favorites: number;
  checkIns: number;
}

const cities = Object.values(CITIES);

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', homeCity: '' });

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setProfile(data.user);
          setStats(data.stats);
          setForm({ name: data.user.name || '', homeCity: data.user.home_city || '' });
        }
      })
      .catch(() => setError('Failed to load profile'))
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
        body: JSON.stringify({ name: form.name, homeCity: form.homeCity || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update'); return; }
      setProfile(data.user);
      setEditing(false);
      setSuccess('Profile updated!');
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Failed to save changes'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading profile...</div></div>;
  if (!profile) return <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">{error || 'Please sign in to view your profile.'}</div>;

  const initials = profile.name ? profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : profile.email?.charAt(0).toUpperCase() || '?';
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-orange-500 text-white flex items-center justify-center text-2xl font-bold shrink-0">
            {profile.avatar ? <img src={profile.avatar} alt={profile.name} className="w-full h-full rounded-full object-cover" /> : initials}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Home City</label>
                  <select value={form.homeCity} onChange={(e) => setForm(f => ({ ...f, homeCity: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm">
                    <option value="">Select a city</option>
                    {cities.map(city => <option key={city.slug} value={city.slug}>{city.name}, {city.country}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
                  <button onClick={() => { setEditing(false); setForm({ name: profile.name || '', homeCity: profile.home_city || '' }); }} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900">{profile.name || 'Dog Lover'}</h2>
                <p className="text-sm text-gray-500">{profile.email}</p>
                {profile.home_city && <p className="text-sm text-gray-500 mt-1">Home city: {cities.find(c => c.slug === profile.home_city)?.name || profile.home_city}</p>}
                <p className="text-xs text-gray-400 mt-1">Member since {memberSince}</p>
                <button onClick={() => setEditing(true)} className="mt-3 px-4 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50">Edit Profile</button>
              </>
            )}
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Link href="/profile/dogs" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-orange-300 transition-colors"><div className="text-2xl font-bold text-gray-900">{stats.dogs}</div><div className="text-sm text-gray-500">Dogs</div></Link>
          <Link href="/profile/reviews" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-orange-300 transition-colors"><div className="text-2xl font-bold text-gray-900">{stats.reviews}</div><div className="text-sm text-gray-500">Reviews</div></Link>
          <Link href="/profile/favorites" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-orange-300 transition-colors"><div className="text-2xl font-bold text-gray-900">{stats.favorites}</div><div className="text-sm text-gray-500">Saved Places</div></Link>
          <Link href="/profile/checkins" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-orange-300 transition-colors"><div className="text-2xl font-bold text-gray-900">{stats.checkIns}</div><div className="text-sm text-gray-500">Check-ins</div></Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/profile/dogs/new" className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
            <span className="text-xl">🐾</span>
            <div><p className="text-sm font-medium text-gray-900">Add a Dog</p><p className="text-xs text-gray-500">Create a profile for your pup</p></div>
          </Link>
          <Link href="/profile/favorites" className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
            <span className="text-xl">❤️</span>
            <div><p className="text-sm font-medium text-gray-900">Saved Places</p><p className="text-xs text-gray-500">View your favorite spots</p></div>
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Dog {
  id: string;
  name: string;
  breed: string | null;
  birth_date: string | null;
  size: string;
  personality: string | null;
  photo: string | null;
  created_at: string;
}

export default function DogDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dogId = params.id as string;

  const [dog, setDog] = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', breed: '', birthDate: '', size: 'MEDIUM', personality: '' });

  useEffect(() => {
    fetch('/api/dogs')
      .then(res => res.json())
      .then(data => {
        const found = (data.dogs || []).find((d: Dog) => d.id === dogId);
        if (found) {
          setDog(found);
          setForm({
            name: found.name || '',
            breed: found.breed || '',
            birthDate: found.birth_date || '',
            size: found.size || 'MEDIUM',
            personality: found.personality || '',
          });
        }
      })
      .catch(() => setError('Failed to load dog profile'))
      .finally(() => setLoading(false));
  }, [dogId]);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/dogs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dogId,
          name: form.name.trim(),
          breed: form.breed.trim() || null,
          birthDate: form.birthDate || null,
          size: form.size,
          personality: form.personality.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update'); return; }
      setDog(data.dog);
      setEditing(false);
      setSuccess('Updated!');
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  if (!dog) return <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">Dog not found. <Link href="/profile/dogs" className="underline">Back to My Dogs</Link></div>;

  const age = dog.birth_date ? (() => {
    const y = new Date().getFullYear() - new Date(dog.birth_date).getFullYear();
    return y > 0 ? `${y} year${y !== 1 ? 's' : ''} old` : 'Puppy';
  })() : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/profile/dogs" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{dog.name}</h1>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {editing ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
              <input type="text" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <select value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none">
                  <option value="SMALL">Small (under 10kg)</option>
                  <option value="MEDIUM">Medium (10-25kg)</option>
                  <option value="LARGE">Large (25-45kg)</option>
                  <option value="XLARGE">Extra Large (45kg+)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
              <textarea value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} rows={3} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditing(false)} className="px-5 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-5">
            <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
              {dog.photo ? <img src={dog.photo} alt={dog.name} className="w-full h-full object-cover" /> : <span className="text-4xl">🐕</span>}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{dog.name}</h2>
              {dog.breed && <p className="text-gray-600">{dog.breed}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {age && <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">{age}</span>}
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{dog.size}</span>
              </div>
              {dog.personality && <p className="text-sm text-gray-500 mt-3">{dog.personality}</p>}
              <button onClick={() => setEditing(true)} className="mt-4 px-4 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50">Edit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

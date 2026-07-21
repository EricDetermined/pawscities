'use client';

import { useState, useEffect, useCallback } from 'react';

interface ModDog {
  id: string;
  slug: string;
  name: string;
  breed: string | null;
  photo: string | null;
  createdAt: string;
  owner: { name: string | null; email: string | null; city: string | null };
}

interface CommunityData {
  counts: { publicDogs: number; follows: number; packs: number; checkInsThisWeek: number };
  dogs: ModDog[];
}

export default function AdminCommunityPage() {
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/community')
      .then(res => res.json())
      .then(d => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const makePrivate = async (dogId: string, name: string) => {
    if (!confirm(`Remove ${name} from the public community directory? The owner keeps the profile; it just stops being public.`)) return;
    setBusy(dogId);
    try {
      const res = await fetch('/api/admin/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dogId, action: 'make_private' }),
      });
      if (res.ok && data) {
        setData({ ...data, dogs: data.dogs.filter(d => d.id !== dogId), counts: { ...data.counts, publicDogs: data.counts.publicDogs - 1 } });
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading community...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const stat = (label: string, value: number, emoji: string) => (
    <div className="bg-white rounded-xl border p-4 text-center">
      <span className="text-xl block">{emoji}</span>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Community</h1>
        <p className="text-sm text-gray-500 mt-1">
          Public dog profiles and social activity. Making a dog private removes it from the
          directory without deleting anything — the owner can re-enable it.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stat('Public dogs', data.counts.publicDogs, '🐶')}
        {stat('Follows', data.counts.follows, '➕')}
        {stat('Packs formed', data.counts.packs, '🐾')}
        {stat('Check-ins (7d)', data.counts.checkInsThisWeek, '📍')}
      </div>

      {data.dogs.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-500">
          No public dog profiles yet. They&apos;ll appear here as owners opt in.
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {data.dogs.map(dog => (
            <div key={dog.id} className="p-4 flex items-center gap-4">
              {dog.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dog.photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-xl shrink-0">🐶</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">
                  {dog.name} <span className="text-gray-400 font-normal">· {dog.breed || 'Mixed breed'}</span>
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {dog.owner.name || 'Unknown owner'}
                  {dog.owner.email ? ` · ${dog.owner.email}` : ''}
                  {dog.owner.city ? ` · ${dog.owner.city}` : ''}
                  {' · added '}{new Date(dog.createdAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={`/dogs/${dog.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 shrink-0"
              >
                View
              </a>
              <button
                onClick={() => makePrivate(dog.id, dog.name)}
                disabled={busy === dog.id}
                className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50 shrink-0"
              >
                Make private
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
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

const SIZE_LABELS: Record<string, string> = {
  SMALL: 'Small (under 10kg)',
  MEDIUM: 'Medium (10-25kg)',
  LARGE: 'Large (25-45kg)',
  XLARGE: 'Extra Large (45kg+)',
};

export default function DogsPage() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dogs')
      .then(res => res.json())
      .then(data => setDogs(data.dogs || []))
      .catch(() => setError('Failed to load dogs'))
      .finally(() => setLoading(false));
  }, []);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    if (years > 0) return `${years} year${years !== 1 ? 's' : ''} old`;
    if (months > 0) return `${months} month${months !== 1 ? 's' : ''} old`;
    return 'Puppy';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading your dogs...</div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Dogs</h1>
        <Link href="/profile/dogs/new" className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
          + Add Dog
        </Link>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {dogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🐕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No dogs yet</h2>
          <p className="text-gray-500 mb-6">Add your first dog to get personalized recommendations and track visits together.</p>
          <Link href="/profile/dogs/new" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">
            🐾 Add Your First Dog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dogs.map(dog => {
            const age = getAge(dog.birth_date);
            return (
              <Link key={dog.id} href={`/profile/dogs/${dog.id}`} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:shadow-sm transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {dog.photo ? (
                      <img src={dog.photo} alt={dog.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🐕</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">{dog.name}</h3>
                    {dog.breed && <p className="text-sm text-gray-600">{dog.breed}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {age && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{age}</span>}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{SIZE_LABELS[dog.size] || dog.size}</span>
                    </div>
                    {dog.personality && <p className="text-xs text-gray-400 mt-2 line-clamp-1">{dog.personality}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

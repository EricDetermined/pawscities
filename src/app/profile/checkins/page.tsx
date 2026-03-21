'use client';

import { useState, useEffect } from 'react';

interface CheckIn {
  id: string;
  note: string | null;
  rating: number | null;
  created_at: string;
  establishment: { name: string; address: string } | null;
  dog: { name: string } | null;
}

export default function CheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/checkins')
      .then(res => res.json())
      .then(data => setCheckIns(data.checkIns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading check-ins...</div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Check-ins</h1>
      {checkIns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No check-ins yet</h2>
          <p className="text-gray-500">Check in at dog-friendly places to track your visits and share your experiences.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {checkIns.map(ci => (
            <div key={ci.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{ci.establishment?.name || 'Unknown place'}</p>
                  {ci.dog && <p className="text-xs text-gray-500">with {ci.dog.name}</p>}
                </div>
                <span className="text-xs text-gray-400">{new Date(ci.created_at).toLocaleDateString()}</span>
              </div>
              {ci.note && <p className="text-sm text-gray-600 mt-2">{ci.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

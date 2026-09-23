'use client';

import { useState, useEffect, useCallback } from 'react';

interface PendingListing {
  id: string;
  name: string;
  slug: string | null;
  city_id: string | null;
  category_id: string | null;
  status: string;
  instagram_handle: string | null;
  instagram_handle_source: string | null;
  website: string | null;
  email: string | null;
  source: string | null;
  listing_type: string | null;
  created_at: string;
  city_name: string | null;
  category_name: string | null;
}

export default function PendingListingsAdminPage() {
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pending-listings');
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending listings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function actOnListing(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !window.confirm('Reject this listing? It will be set to INACTIVE and stay hidden from the public site.')) return;
    setActing(id);
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/pending-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (res.ok) {
        // Optimistically remove the row from the pending queue
        setListings(prev => prev.filter(l => l.id !== id));
      } else {
        setErrorMessage(data.error || 'Action failed');
      }
    } catch {
      setErrorMessage('Action failed');
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending Listings</h1>
        <p className="text-gray-500 mt-1">
          Review auto-created establishment drafts and approve to publish, or reject to hide.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-600">{listings.length}</p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {listings.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No listings pending review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Name</th>
                  <th className="text-left p-3 font-medium text-gray-600">City</th>
                  <th className="text-left p-3 font-medium text-gray-600">Category</th>
                  <th className="text-left p-3 font-medium text-gray-600">Instagram</th>
                  <th className="text-left p-3 font-medium text-gray-600">Website</th>
                  <th className="text-left p-3 font-medium text-gray-600">Source</th>
                  <th className="text-left p-3 font-medium text-gray-600">Created</th>
                  <th className="text-left p-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map(listing => {
                  const handle = listing.instagram_handle
                    ? listing.instagram_handle.replace(/^@/, '')
                    : null;
                  return (
                    <tr key={listing.id} className="border-b hover:bg-gray-50 align-top">
                      <td className="p-3 font-medium text-gray-900">{listing.name}</td>
                      <td className="p-3 text-gray-600">{listing.city_name || '—'}</td>
                      <td className="p-3 text-gray-600">{listing.category_name || '—'}</td>
                      <td className="p-3">
                        {handle ? (
                          <a
                            href={`https://instagram.com/${handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:underline"
                          >
                            @{handle}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        {listing.website ? (
                          <a
                            href={listing.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:underline"
                          >
                            {listing.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600">{listing.source || '—'}</td>
                      <td className="p-3 text-gray-400 text-xs">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => actOnListing(listing.id, 'approve')}
                            disabled={acting === listing.id}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {acting === listing.id ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => actOnListing(listing.id, 'reject')}
                            disabled={acting === listing.id}
                            className="px-3 py-1.5 border border-red-200 text-red-600 rounded-md text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

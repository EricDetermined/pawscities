'use client';

import { useState, useEffect, useCallback } from 'react';

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  status: string;
  createdAt: string;
  establishment: {
    id: string;
    name: string;
    slug: string;
    tier: string;
  } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPhotos = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/photos?status=${statusFilter}&page=${page}`);
      const data = await res.json();
      if (res.ok) {
        setPhotos(data.photos || []);
        setPagination(data.pagination);
      } else {
        setError(data.error || 'Failed to fetch photos');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleAction = async (photoId: string, action: 'approve' | 'reject') => {
    setProcessing(photoId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        setSelectedPhoto(null);
        // Remove from current list
        setPhotos(prev => prev.filter(p => p.id !== photoId));
      } else {
        setError(data.error || `Failed to ${action} photo`);
      }
    } catch {
      setError(`Failed to ${action} photo`);
    } finally {
      setProcessing(null);
    }
  };

  const statusTabs = [
    { key: 'PENDING', label: 'Pending Review', color: 'text-yellow-600' },
    { key: 'APPROVED', label: 'Approved', color: 'text-green-600' },
    { key: 'REJECTED', label: 'Rejected', color: 'text-red-600' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Photo Moderation</h1>
        <p className="text-gray-600">Review and approve business photo submissions</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {statusTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              statusFilter === tab.key
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading photos...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && photos.length === 0 && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-5xl mb-4">
            {statusFilter === 'PENDING' ? '\u2705' : '\u{1F4F7}'}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {statusFilter === 'PENDING'
              ? 'No photos pending review'
              : `No ${statusFilter.toLowerCase()} photos`}
          </h2>
          <p className="text-gray-600">
            {statusFilter === 'PENDING'
              ? 'All caught up! Check back later for new submissions.'
              : 'Photos will appear here once they are reviewed.'}
          </p>
        </div>
      )}

      {/* Photo Grid */}
      {!loading && photos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map(photo => (
            <div
              key={photo.id}
              className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Photo preview */}
              <div
                className="aspect-[4/3] bg-gray-100 cursor-pointer relative"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || 'Submitted photo'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center">
                  <span className="text-white opacity-0 hover:opacity-100 text-sm font-medium">
                    Click to enlarge
                  </span>
                </div>
              </div>

              {/* Photo details */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                 {photo.establishment?.name || 'Unknown business'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    photo.establishment?.tier === 'premium'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {photo.establishment?.tier || 'free'}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-1">
                  Submitted by: {photo.user?.email || 'Unknown'}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(photo.createdAt).toLocaleString()}
                </p>

                {photo.caption && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{photo.caption}</p>
                )}

                {/* Action Buttons */}
                {statusFilter === 'PENDING' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleAction(photo.id, 'approve')}
                      disabled={processing === photo.id}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {processing === photo.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAction(photo.id, 'reject')}
                      disabled={processing === photo.id}
                      className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {processing === photo.id ? '...' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => fetchPhotos(page)}
              className={`px-3 py-1 text-sm rounded-lg ${
                page === pagination.page
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black bg-opacity-80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="max-w-4xl w-full bg-white rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || 'Photo'}
                className="w-full max-h-[60vh] object-contain bg-gray-900"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedPhoto.establishment?.name || 'Unknown business'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Submitted by {selectedPhoto.user?.email || 'Unknown'} on{' '}
                    {new Date(selectedPhoto.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedPhoto.caption && (
                <p className="text-sm text-gray-600 mb-4">{selectedPhoto.caption}</p>
              )}

              {statusFilter === 'PENDING' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(selectedPhoto.id, 'approve')}
                    disabled={processing === selectedPhoto.id}
                    className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing === selectedPhoto.id ? 'Processing...' : 'Approve Photo'}
                  </button>
                  <button
                    onClick={() => handleAction(selectedPhoto.id, 'reject')}
                    disabled={processing === selectedPhoto.id}
                    className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {processing === selectedPhoto.id ? 'Processing...' : 'Reject Photo'}
                  </button>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="px-6 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

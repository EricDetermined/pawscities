'use client';

import { useState, useEffect, useCallback } from 'react';
import { TierBadge } from '@/components/business/TierBadge';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import Link from 'next/link';

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

interface GooglePhoto {
  photoRef: string;
  url: string;
  thumbnailUrl: string;
  label: string;
}

interface PhotosData {
  photos: Photo[];
  googlePhotos: GooglePhoto[];
  googlePlaceId: string | null;
  tier: string;
  maxPhotos: number;
  establishmentId: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Review' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export default function PhotosPage() {
  const [data, setData] = useState<PhotosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      const response = await fetch('/api/business/photos');
      if (!response.ok) throw new Error('Failed to load photos');
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error(err);
      setError('Failed to load photo data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handlePhotosUploaded = async (urls: string[]) => {
    if (urls.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/business/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to save photos');
        return;
      }
      setSuccessMessage(result.message);
      await fetchPhotos();
    } catch {
      setError('Failed to save photos. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const response = await fetch('/api/business/photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error || 'Failed to delete photo');
        return;
      }
      setDeleteConfirm(null);
      await fetchPhotos();
    } catch {
      setError('Failed to delete photo');
    }
  };

  const handleSelectGooglePhoto = async (googlePhoto: GooglePhoto) => {
    setSavingGoogle(googlePhoto.photoRef);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/business/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [googlePhoto.url],
          captions: [googlePhoto.label],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to save Google photo');
        return;
      }
      setSuccessMessage('Google Business photo added and pending review.');
      await fetchPhotos();
    } catch {
      setError('Failed to save Google photo. Please try again.');
    } finally {
      setSavingGoogle(null);
    }
  };

  // Check if a Google photo has already been added (by matching the proxy URL pattern)
  const isGooglePhotoAlreadyAdded = (googlePhoto: GooglePhoto) => {
    if (!data) return false;
    return data.photos.some(p => p.url === googlePhoto.url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error || 'Failed to load photo data'}
      </div>
    );
  }

  const { photos, tier, maxPhotos } = data;
  const activePhotos = photos.filter(p => p.status !== 'REJECTED');
  const canUploadMore = activePhotos.length < maxPhotos;
  const remainingSlots = Math.max(0, maxPhotos - activePhotos.length);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Photos</h1>
          <p className="text-gray-600">
            Upload photos to showcase your business ({activePhotos.length}/{maxPhotos} used)
          </p>
        </div>
        <TierBadge tier={tier} />
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <p className="font-medium">{successMessage}</p>
          <p className="text-sm mt-1">Our team will review your photos within 1-2 business days.</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Image Guidelines */}
      <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-5">
        <h3 className="font-semibold text-blue-900 mb-3">Photo Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5 flex-shrink-0">&#10003;</span>
            <span><strong>Minimum size:</strong> 800 x 600 pixels (landscape preferred)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5 flex-shrink-0">&#10003;</span>
            <span><strong>File types:</strong> JPG, PNG, or WebP</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5 flex-shrink-0">&#10003;</span>
            <span><strong>Max file size:</strong> 5MB per image</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5 flex-shrink-0">&#10003;</span>
            <span><strong>Best photos:</strong> Interior, patio, dogs enjoying your space</span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-3">
          Avoid photos with watermarks, logos, or heavy filters. All photos are reviewed before appearing on your listing.
        </p>
      </div>

      {/* Google Business Photos */}
      {data.googlePhotos && data.googlePhotos.length > 0 && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Google Business Photos</h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">From Google</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            We found photos from your Google Business Profile. Select any to use on your Paw Cities listing.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.googlePhotos.map((gPhoto) => {
              const alreadyAdded = isGooglePhotoAlreadyAdded(gPhoto);
              const isSaving = savingGoogle === gPhoto.photoRef;
              return (
                <div key={gPhoto.photoRef} className="relative border border-gray-200 rounded-lg overflow-hidden">
                  <div className="aspect-[4/3] bg-gray-100">
                    <img
                      src={gPhoto.thumbnailUrl}
                      alt={gPhoto.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-2">{gPhoto.label}</p>
                    {alreadyAdded ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                        <span>&#10003;</span> Added
                      </span>
                    ) : !canUploadMore ? (
                      <span className="text-xs text-gray-400">Photo limit reached</span>
                    ) : (
                      <button
                        onClick={() => handleSelectGooglePhoto(gPhoto)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? 'Adding...' : 'Use This Photo'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Google photos are subject to the same review process as uploaded photos.
          </p>
        </div>
      )}

      {/* Upload Section */}
      {canUploadMore ? (
        <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload New Photos</h2>
          <p className="text-sm text-gray-500 mb-4">
            You can upload {remainingSlots} more photo{remainingSlots !== 1 ? 's' : ''} on your {tier} plan.
          </p>
          <PhotoUpload
            onPhotosChange={handlePhotosUploaded}
            maxPhotos={remainingSlots}
          />
          {saving && (
            <div className="mt-3 text-sm text-orange-600 font-medium">
              Saving photos...
            </div>
          )}
        </div>
      ) : (
        <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-600 mb-3">
            You&apos;ve reached the maximum of {maxPhotos} photo{maxPhotos !== 1 ? 's' : ''} for your {tier} plan.
          </p>
          {tier === 'free' && (
            <Link
              href="/business/upgrade"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              <span>&#128081;</span> Upgrade to Premium for up to 10 photos
            </Link>
          )}
        </div>
      )}

      {/* Existing Photos */}
      {photos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Photos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((photo) => {
              const status = STATUS_STYLES[photo.status] || STATUS_STYLES.PENDING;
              return (
                <div key={photo.id} className="relative group border border-gray-200 rounded-lg overflow-hidden">
                  <div className="aspect-[4/3] bg-gray-100">
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Business photo'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(photo.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {photo.caption && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{photo.caption}</p>
                    )}
                    {photo.status === 'REJECTED' && (
                      <p className="text-xs text-red-500 mt-1">
                        This photo was not approved. You may upload a replacement.
                      </p>
                    )}
                  </div>

                  {/* Delete button */}
                  {deleteConfirm === photo.id ? (
                    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                      <div className="bg-white rounded-lg p-4 mx-4 text-center">
                        <p className="text-sm font-medium text-gray-900 mb-3">Delete this photo?</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(photo.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                      title="Delete photo"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No photos yet */}
      {photos.length === 0 && !canUploadMore && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-5xl mb-4">&#128248;</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No photos yet</h2>
          <p className="text-gray-600">
            Upload your first photo to make your listing stand out!
          </p>
        </div>
      )}

      {/* Tier Info */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Photo Limits by Plan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 rounded-lg border ${tier === 'free' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900">Free Plan</span>
              {tier === 'free' && <span className="text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full">Current</span>}
            </div>
            <p className="text-sm text-gray-600">1 photo for your listing</p>
          </div>
          <div className={`p-4 rounded-lg border ${tier === 'premium' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900">Premium Plan</span>
              {tier === 'premium' && <span className="text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full">Current</span>}
            </div>
            <p className="text-sm text-gray-600">Up to 10 photos with priority placement</p>
          </div>
        </div>
      </div>
    </div>
  );
}

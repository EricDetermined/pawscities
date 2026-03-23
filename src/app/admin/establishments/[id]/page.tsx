'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface EstablishmentDetail {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  city_id: string;
  status: string;
  tier: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  opening_hours: string | null;
  primary_image: string | null;
  photo_refs: string[] | null;
  rating: number;
  review_count: number;
  claimed_by?: string;
  cities?: { id: string; name: string };
  categories?: Category | null;
  allCategories?: Category[];
}

export default function EditEstablishmentPage() {
  const params = useParams();
  const router = useRouter();
  const estId = params.id as string;

  const [establishment, setEstablishment] = useState<EstablishmentDetail | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Image state
  const [imageSource, setImageSource] = useState<'google' | 'uploaded' | 'none'>('none');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    tier: 'free',
    status: 'ACTIVE',
  });

  useEffect(() => {
    async function fetchEstablishment() {
      try {
        const response = await fetch(`/api/admin/establishments/${estId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch establishment');
        }
        const json = await response.json();
        setEstablishment(json);
        setAllCategories(json.allCategories || []);
        setFormData({
          name: json.name,
          description: json.description || '',
          category: json.category_id || '',
          address: json.address || '',
          phone: json.phone || '',
          email: json.email || '',
          website: json.website || '',
          tier: json.tier || 'free',
          status: json.status || 'ACTIVE',
        });

        // Determine image source
        if (json.primary_image) {
          if (json.primary_image.includes('/api/places/photo') || json.photo_refs?.length > 0) {
            setImageSource('google');
          } else {
            setImageSource('uploaded');
            setUploadedImageUrl(json.primary_image);
          }
        } else {
          setImageSource('none');
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching establishment:', err);
        setError('Failed to load establishment');
        setEstablishment(null);
      } finally {
        setLoading(false);
      }
    }

    fetchEstablishment();
  }, [estId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('establishmentId', estId);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadedImageUrl(data.url);
      setImageSource('uploaded');
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to upload image. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const getGooglePhotoUrl = (photoRef: string) => {
    return `/api/places/photo?name=${encodeURIComponent(photoRef)}&maxWidth=800`;
  };

  const getCurrentImageUrl = (): string | null => {
    if (imageSource === 'google' && establishment?.photo_refs?.length) {
      return getGooglePhotoUrl(establishment.photo_refs[0]);
    }
    if (imageSource === 'uploaded' && uploadedImageUrl) {
      return uploadedImageUrl;
    }
    if (establishment?.primary_image) {
      return establishment.primary_image;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setMessage(null);

      // Determine primary image based on selection
      let primaryImage = establishment?.primary_image;
      if (imageSource === 'google' && establishment?.photo_refs?.length) {
        primaryImage = getGooglePhotoUrl(establishment.photo_refs[0]);
      } else if (imageSource === 'uploaded' && uploadedImageUrl) {
        primaryImage = uploadedImageUrl;
      }

      const response = await fetch(`/api/admin/establishments/${estId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          primaryImage,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to update establishment');
      }

      setMessage({ type: 'success', text: 'Establishment updated successfully!' });
      setTimeout(() => router.push('/admin/establishments'), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update establishment';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/admin/establishments" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
          &larr; Back to Establishments
        </Link>
        <div className="bg-white rounded-xl border p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !establishment) {
    return (
      <div className="space-y-6">
        <Link href="/admin/establishments" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
          &larr; Back to Establishments
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800">{error || 'Failed to load establishment'}</p>
        </div>
      </div>
    );
  }

  const currentImageUrl = getCurrentImageUrl();
  const hasGooglePhotos = (establishment.photo_refs?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link href="/admin/establishments" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
        &larr; Back to Establishments
      </Link>

      {/* Messages */}
      {message && (
        <div className={`rounded-xl p-4 ${message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>{message.text}</p>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Establishment</h1>
        <p className="text-gray-600 mt-1">{establishment.name}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <FormField label="Name" name="name" value={formData.name} onChange={handleChange} required />
            <FormField label="Description" name="description" value={formData.description} onChange={handleChange} type="textarea" rows={4} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category<span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Category</option>
                {allCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {establishment.categories && (
                <p className="mt-1 text-xs text-gray-400">
                  Current: {establishment.categories.name} ({establishment.categories.slug})
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Image Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Image</h2>

          {/* Current Image Preview */}
          {currentImageUrl ? (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Current image:</p>
              <div className="relative w-full max-w-md h-48 rounded-lg overflow-hidden border bg-gray-50">
                <img
                  src={currentImageUrl}
                  alt={establishment.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect fill="%23f3f4f6" width="400" height="200"/><text fill="%239ca3af" font-size="14" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Image failed to load</text></svg>';
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Source: {imageSource === 'google' ? 'Google Places' : imageSource === 'uploaded' ? 'Uploaded' : 'Unknown'}
              </p>
            </div>
          ) : (
            <div className="mb-4 p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center">
              <p className="text-gray-500">No image set for this establishment</p>
            </div>
          )}

          {/* Image Source Toggle */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Image source:</p>
            <div className="flex flex-wrap gap-3">
              {hasGooglePhotos && (
                <button
                  type="button"
                  onClick={() => setImageSource('google')}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    imageSource === 'google'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Use Google Places photo
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  imageSource === 'uploaded'
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {uploading ? 'Uploading...' : 'Upload new image'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Google Photos Gallery */}
            {hasGooglePhotos && imageSource === 'google' && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Google Places photos ({establishment.photo_refs!.length} available):</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {establishment.photo_refs!.slice(0, 5).map((ref, i) => (
                    <div key={i} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border bg-gray-50">
                      <img
                        src={getGooglePhotoUrl(ref)}
                        alt={`Google photo ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasGooglePhotos && (
              <p className="text-xs text-gray-400">No Google Places photos available for this establishment.</p>
            )}
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
          <div className="space-y-4">
            <FormField label="Address" name="address" value={formData.address} onChange={handleChange} />
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Phone" name="phone" value={formData.phone} onChange={handleChange} type="tel" />
            <FormField label="Email" name="email" value={formData.email} onChange={handleChange} type="email" />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-500 text-sm">https://</span>
                <input
                  type="text"
                  name="website"
                  value={formData.website.replace(/^https?:\/\//, '')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^https?:\/\//, '');
                    setFormData(prev => ({ ...prev, website: val ? `https://${val}` : '' }));
                  }}
                  placeholder="www.example.com"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Tier"
              name="tier"
              value={formData.tier}
              onChange={handleChange}
              type="select"
              options={[
                { value: 'free', label: 'Free' },
                { value: 'claimed', label: 'Claimed' },
                { value: 'premium', label: 'Premium' },
              ]}
            />
            <FormField
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              type="select"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PENDING_REVIEW', label: 'Pending Review' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-gray-50 rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Information</h2>
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-gray-600">ID:</span>
              <span className="ml-2 font-mono text-gray-900">{establishment.id}</span>
            </p>
            <p>
              <span className="text-gray-600">Rating:</span>
              <span className="ml-2 font-medium text-gray-900">
                {establishment.rating?.toFixed(1) || '0.0'} ({establishment.review_count || 0} reviews)
              </span>
            </p>
            <p>
              <span className="text-gray-600">City:</span>
              <span className="ml-2 text-gray-900">{establishment.cities?.name || 'Unknown'}</span>
            </p>
            {establishment.claimed_by && (
              <p>
                <span className="text-gray-600">Claimed By:</span>
                <span className="ml-2 text-gray-900">{establishment.claimed_by}</span>
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/admin/establishments"
            className="px-6 py-2 border rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  rows,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  type?: string;
  required?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      ) : type === 'select' ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select {label}</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      )}
    </div>
  );
}

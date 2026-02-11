'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface EstablishmentDetail {
  id: string;
  name: string;
  description: string | null;
  category: string;
  city_id: string;
  status: string;
  tier: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: string | null;
  image_url: string | null;
  rating: number;
  reviews_count: number;
  claimed_by?: string;
  cities?: {
    id: string;
    name: string;
  };
}

export default function EditEstablishmentPage() {
  const params = useParams();
  const router = useRouter();
  const estId = params.id as string;

  const [establishment, setEstablishment] = useState<EstablishmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setFormData({
          name: json.name,
          description: json.description || '',
          category: json.category,
          address: json.address || '',
          phone: json.phone || '',
          email: json.email || '',
          website: json.website || '',
          tier: json.tier,
          status: json.status,
        });
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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setMessage(null);

      const response = await fetch(`/api/admin/establishments/${estId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to update establishment');
      }

      setMessage({
        type: 'success',
        text: 'Establishment updated successfully!',
      });
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
        <Link
          href="/admin/establishments"
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          ← Back to Establishments
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
        <Link
          href="/admin/establishments"
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          ← Back to Establishments
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800">{error || 'Failed to load establishment'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/admin/establishments"
        className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
      >
        ← Back to Establishments
      </Link>

      {/* Messages */}
      {message && (
        <div
          className={`rounded-xl p-4 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <p
            className={
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }
          >
            {message.text}
          </p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <FormField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <FormField
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              type="textarea"
              rows={4}
            />
            <FormField
              label="Category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              type="select"
              options={[
                { value: 'restaurants', label: 'Restaurants' },
                { value: 'cafes', label: 'Cafes' },
                { value: 'parks', label: 'Parks' },
                { value: 'hotels', label: 'Hotels' },
                { value: 'vets', label: 'Vets' },
                { value: 'groomers', label: 'Groomers' },
                { value: 'shops', label: 'Shops' },
                { value: 'activities', label: 'Activities' },
              ]}
              required
            />
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Location
          </h2>
          <div className="space-y-4">
            <FormField
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contact Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              type="tel"
            />
            <FormField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              type="email"
            />
            <FormField
              label="Website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              type="url"
              colSpan={2}
            />
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Settings
          </h2>
          <div className="grid grid-cols-2 gap-4">
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
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-gray-50 rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Information
          </h2>
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-gray-600">ID:</span>
              <span className="ml-2 font-mono text-gray-900">
                {establishment.id}
              </span>
            </p>
            <p>
              <span className="text-gray-600">Rating:</span>
              <span className="ml-2 font-medium text-gray-900">
                {establishment.rating.toFixed(1)} ({establishment.reviews_count} reviews)
              </span>
            </p>
            <p>
              <span className="text-gray-600">City:</span>
              <span className="ml-2 text-gray-900">
                {establishment.cities?.name || 'Unknown'}
              </span>
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
  colSpan = 1,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  type?: string;
  required?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
  colSpan?: number;
}) {
  return (
    <div style={{ gridColumn: colSpan > 1 ? `span ${colSpan}` : undefined }}>
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
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
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

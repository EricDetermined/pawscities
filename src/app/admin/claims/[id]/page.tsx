'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface ClaimDetail {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  review_notes: string | null;
  establishment_id: string;
  user_id: string;
  business_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  verification_method: string | null;
  establishment?: {
    id: string;
    name: string;
    slug: string;
    category_id: string;
    city_id: string;
    status: string;
    tier: string;
    rating?: number;
    review_count?: number;
  } | null;
  user?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const claimId = params.id as string;

  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchClaim() {
      try {
        const response = await fetch(`/api/admin/claims/${claimId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch claim');
        }
        const json = await response.json();
        setClaim(json);
        setError(null);
      } catch (err) {
        console.error('Error fetching claim:', err);
        setError('Failed to load claim details');
        setClaim(null);
      } finally {
        setLoading(false);
      }
    }

    fetchClaim();
  }, [claimId]);

  const handleApprove = async () => {
    if (!claim) return;

    try {
      setSubmitting(true);
      setMessage(null);

      const response = await fetch(`/api/admin/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          reviewNotes: reviewNotes || undefined,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to approve claim');
      }

      setMessage({ type: 'success', text: 'Claim approved successfully!' });
      setTimeout(() => router.push('/admin/claims'), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to approve claim';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!claim) return;

    try {
      setSubmitting(true);
      setMessage(null);

      const response = await fetch(`/api/admin/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reviewNotes: reviewNotes || undefined,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to reject claim');
      }

      setMessage({ type: 'success', text: 'Claim rejected successfully!' });
      setTimeout(() => router.push('/admin/claims'), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to reject claim';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/claims"
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          ← Back to Claims
        </Link>
        <div className="bg-white rounded-xl border p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded w-2/3"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/claims"
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          ← Back to Claims
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800">{error || 'Failed to load claim details'}</p>
        </div>
      </div>
    );
  }

  // Status comes as uppercase from DB (PENDING, APPROVED, REJECTED)
  const isPending = claim.status.toUpperCase() === 'PENDING';
  const statusDisplay = claim.status.charAt(0).toUpperCase() + claim.status.slice(1).toLowerCase();

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/admin/claims"
        className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
      >
        ← Back to Claims
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {claim.business_name || claim.establishment?.name || 'Unknown Business'}
          </h1>
          <p className="text-gray-600 mt-1">
            Claim #{claim.id.slice(0, 8)}
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded-full font-medium text-sm uppercase ${
            isPending
              ? 'bg-yellow-100 text-yellow-700'
              : claim.status.toUpperCase() === 'APPROVED'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {statusDisplay}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Establishment Info */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Establishment Details
            </h2>
            <div className="space-y-4">
              <InfoRow label="Name" value={claim.establishment?.name || claim.business_name} />
              <InfoRow label="Status" value={claim.establishment?.status} />
              <InfoRow label="Tier" value={claim.establishment?.tier} />
              {claim.establishment?.rating !== undefined && claim.establishment.rating > 0 && (
                <InfoRow
                  label="Rating"
                  value={`${claim.establishment.rating} ⭐ (${claim.establishment.review_count || 0} reviews)`}
                />
              )}
            </div>
          </div>

          {/* Claimant Info */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Claimant Information
            </h2>
            <div className="space-y-4">
              <InfoRow
                label="Name"
                value={claim.contact_name || claim.user?.name}
              />
              <InfoRow label="Email" value={claim.contact_email || claim.user?.email} />
              {claim.contact_phone && (
                <InfoRow label="Phone" value={claim.contact_phone} />
              )}
              <InfoRow
                label="Verification"
                value={claim.verification_method?.replace(/_/g, ' ')}
              />
              <InfoRow
                label="Submitted"
                value={new Date(claim.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            </div>
          </div>

          {/* Review Notes Input */}
          {isPending && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Review Notes
              </h2>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this claim (optional)"
                rows={4}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-sm text-gray-500 mt-2">
                These notes will be saved with the claim for future reference.
              </p>
            </div>
          )}

          {/* Previous Notes */}
          {claim.review_notes && (
            <div className="bg-gray-50 rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Previous Review Notes
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap">
                {claim.review_notes}
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Actions */}
        <div>
          {isPending && (
            <div className="bg-white rounded-xl border p-6 sticky top-20">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Actions
              </h2>
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {submitting ? 'Processing...' : '✅ Approve Claim'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {submitting ? 'Processing...' : '❌ Reject Claim'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                This action cannot be undone
              </p>
            </div>
          )}

          {!isPending && (
            <div className="bg-gray-50 rounded-xl border p-6 sticky top-20">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Status
              </h2>
              <div
                className={`px-4 py-3 rounded-lg text-center font-medium ${
                  claim.status.toUpperCase() === 'APPROVED'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {statusDisplay}
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Updated {new Date(claim.updated_at).toLocaleDateString()}
              </p>
              {claim.status.toUpperCase() === 'APPROVED' && claim.contact_email && (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/admin/claims/${claim.id}/resend-email`, { method: 'POST' });
                      const data = await res.json();
                      if (res.ok) {
                        alert('Approval email resent to ' + claim.contact_email);
                      } else {
                        alert('Failed: ' + (data.error || 'Unknown error'));
                      }
                    } catch {
                      alert('Failed to resend email');
                    }
                  }}
                  className="mt-4 w-full px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Resend Approval Email
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between py-3 border-b last:border-b-0">
      <span className="text-gray-600 font-medium">{label}</span>
      <span className="text-gray-900 text-right">{value || 'N/A'}</span>
    </div>
  );
}

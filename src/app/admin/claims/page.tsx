'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Claim {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  establishment_id: string;
  user_id: string;
  establishments?: {
    id: string;
    name: string;
    category: string;
    city_id: string;
  };
  users?: {
    id: string;
    email: string;
    display_name: string;
  };
}

interface ClaimsResponse {
  claims: Claim[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function ClaimsPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [data, setData] = useState<ClaimsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClaims() {
      try {
        setLoading(true);
        const url = new URL('/api/admin/claims', window.location.origin);
        if (status !== 'all') {
          url.searchParams.set('status', status);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch claims');
        }
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        console.error('Error fetching claims:', err);
        setError('Failed to load claims');
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchClaims();
  }, [status]);

  const tabs = [
    { label: 'All', value: 'all' as const },
    { label: 'Pending', value: 'pending' as const, badge: data?.pagination.total },
    { label: 'Approved', value: 'approved' as const },
    { label: 'Rejected', value: 'rejected' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Claims</h1>
          <p className="text-gray-600">
            Review and manage business ownership claims
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white rounded-xl border p-2">
        <div className="flex gap-2 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors relative ${
                status === tab.value
                  ? 'border-b-orange-500 text-orange-600'
                  : 'border-b-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-2 inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="divide-y">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claims List */}
      {!loading && data && (
        <>
          {data.claims.length > 0 ? (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="divide-y">
                {data.claims.map((claim) => (
                  <ClaimRow key={claim.id} claim={claim} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border p-12 text-center">
              <p className="text-gray-500 mb-2">No claims found</p>
              <p className="text-sm text-gray-400">
                {status === 'pending'
                  ? 'All claims have been reviewed'
                  : `No ${status} claims at this time`}
              </p>
            </div>
          )}

          {/* Pagination Info */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>
              Showing {data.claims.length} of {data.pagination.total} claims
            </p>
            <p>
              Page {data.pagination.page} of {data.pagination.pages}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ClaimRow({ claim }: { claim: Claim }) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900">
              {claim.establishments?.name || 'Unknown Establishment'}
            </h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                claim.status
              )}`}
            >
              {claim.status}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
            <div>
              <span className="text-gray-400">Claimant:</span>
              <p>{claim.users?.display_name || claim.users?.email || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-gray-400">Category:</span>
              <p className="capitalize">
                {claim.establishments?.category || 'Unknown'}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Submitted:</span>
              <p>{formatDate(claim.created_at)}</p>
            </div>
            <div>
              <span className="text-gray-400">Contact:</span>
              <p className="truncate">{claim.users?.email || 'N/A'}</p>
            </div>
          </div>
        </div>
        <Link
          href={`/admin/claims/${claim.id}`}
          className="ml-4 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

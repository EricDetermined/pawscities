'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Establishment {
  id: string;
  name: string;
  slug: string;
  address: string;
  city_id: string;
  primary_image: string | null;
  category_id: string | null;
  categories: { name: string } | null;
  isClaimed: boolean;
}

interface Claim {
  id: string;
  status: string;
  business_name: string;
  created_at: string;
  establishments: {
    name: string;
    slug: string;
    address: string;
  } | null;
}

export default function ClaimBusinessPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Establishment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [existingClaims, setExistingClaims] = useState<Claim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);

  // Claim form state
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);
  const [claimForm, setClaimForm] = useState({
    businessName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load existing claims
  useEffect(() => {
    fetch('/api/business/claim')
      .then(res => res.json())
      .then(data => {
        setExistingClaims(data.claims || []);
        setLoadingClaims(false);
      })
      .catch(() => setLoadingClaims(false));
  }, []);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/business/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.establishments || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectEstablishment = (est: Establishment) => {
    setSelectedEstablishment(est);
    setClaimForm(prev => ({ ...prev, businessName: est.name }));
    setSubmitResult(null);
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEstablishment) return;

    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch('/api/business/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId: selectedEstablishment.id,
          businessName: claimForm.businessName,
          contactName: claimForm.contactName,
          contactEmail: claimForm.contactEmail,
          contactPhone: claimForm.contactPhone,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitResult({
          success: true,
          message: 'Your claim has been submitted! We will review it and get back to you within 1-2 business days.',
        });
        setSelectedEstablishment(null);
        setClaimForm({ businessName: '', contactName: '', contactEmail: '', contactPhone: '' });
        // Refresh claims
        const claimsRes = await fetch('/api/business/claim');
        const claimsData = await claimsRes.json();
        setExistingClaims(claimsData.claims || []);
      } else {
        setSubmitResult({ success: false, message: data.error || 'Failed to submit claim' });
      }
    } catch {
      setSubmitResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Claim Your Business</h1>
        <p className="text-gray-600">
          Search for your establishment below, then submit a claim to manage your listing on Paw Cities.
        </p>
      </div>

      {/* Existing Claims */}
      {!loadingClaims && existingClaims.length > 0 && (
        <div className="mb-8 bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Claims</h2>
          <div className="space-y-3">
            {existingClaims.map(claim => (
              <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{claim.business_name}</p>
                  {claim.establishments && (
                    <p className="text-sm text-gray-500">{claim.establishments.address}</p>
                  )}
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  claim.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : claim.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {claim.status === 'approved' ? '✓ Approved' : claim.status === 'pending' ? '⏳ Pending Review' : '✗ Rejected'}
                </span>
              </div>
            ))}
          </div>
          {existingClaims.some(c => c.status === 'approved') && (
            <Link
              href="/business"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Go to Business Dashboard →
            </Link>
          )}
        </div>
      )}

      {/* Success/Error Message */}
      {submitResult && (
        <div className={`mb-6 p-4 rounded-lg ${
          submitResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <p className="font-medium">{submitResult.success ? '✓ Claim Submitted!' : 'Error'}</p>
          <p className="text-sm mt-1">{submitResult.message}</p>
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Find Your Establishment</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by business name or address..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || searchQuery.trim().length < 2}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isSearching ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} found`}
          </h2>

          {!isSearching && searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium">No establishments found</p>
              <p className="text-sm">Try a different search term or check the spelling</p>
            </div>
          )}

          <div className="space-y-3">
            {searchResults.map(est => (
              <div
                key={est.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  selectedEstablishment?.id === est.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-4">
                  {est.primary_image ? (
                    <img
                      src={est.primary_image}
                      alt={est.name}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                      🏢
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{est.name}</p>
                    <p className="text-sm text-gray-500">{est.address}</p>
                    {est.categories && (
                      <span className="text-xs text-orange-600 font-medium">{est.categories.name}</span>
                    )}
                  </div>
                </div>
                <div>
                  {est.isClaimed ? (
                    <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-lg">
                      Already Claimed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSelectEstablishment(est)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        selectedEstablishment?.id === est.id
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                    >
                      {selectedEstablishment?.id === est.id ? 'Selected' : 'Claim This Business'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim Form */}
      {selectedEstablishment && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Submit Your Claim</h2>
          <p className="text-sm text-gray-500 mb-6">
            Claiming <strong>{selectedEstablishment.name}</strong> at {selectedEstablishment.address}
          </p>

          <form onSubmit={handleSubmitClaim} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                value={claimForm.businessName}
                onChange={(e) => setClaimForm(prev => ({ ...prev, businessName: e.target.value }))}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={claimForm.contactName}
                  onChange={(e) => setClaimForm(prev => ({ ...prev, contactName: e.target.value }))}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={claimForm.contactEmail}
                  onChange={(e) => setClaimForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (optional)</label>
              <input
                type="tel"
                value={claimForm.contactPhone}
                onChange={(e) => setClaimForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Claim'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedEstablishment(null)}
                className="px-6 py-2.5 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>What happens next?</strong> After submitting your claim, our team will verify your ownership within 1-2 business days.
              Once approved, you&apos;ll have full access to manage your listing, respond to reviews, and view analytics.
            </p>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <h3 className="font-semibold text-gray-900 mb-1">1. Find Your Business</h3>
          <p className="text-sm text-gray-600">Search for your establishment by name or address</p>
        </div>
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-3xl mb-3">📝</div>
          <h3 className="font-semibold text-gray-900 mb-1">2. Submit Your Claim</h3>
          <p className="text-sm text-gray-600">Fill out your contact details for verification</p>
        </div>
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-3xl mb-3">🚀</div>
          <h3 className="font-semibold text-gray-900 mb-1">3. Start Managing</h3>
          <p className="text-sm text-gray-600">Once approved, manage your listing and grow your business</p>
        </div>
      </div>
    </div>
  );
}

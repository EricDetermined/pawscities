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

interface SelectOption {
  id: string;
  name: string;
  slug: string;
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

  // New business form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [cities, setCities] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [newForm, setNewForm] = useState({
    name: '',
    address: '',
    city_id: '',
    category_id: '',
    description: '',
    phone: '',
    website: '',
    contactName: '',
    contactEmail: '',
  });
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

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

  // Load cities and categories when new form opens
  useEffect(() => {
    if (showNewForm && cities.length === 0) {
      fetch('/api/business/submit')
        .then(res => res.json())
        .then(data => {
          setCities(data.cities || []);
          setCategories(data.categories || []);
        })
        .catch(() => {});
    }
  }, [showNewForm, cities.length]);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;

    setIsSearching(true);
    setHasSearched(true);
    setShowNewForm(false);
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
    setShowNewForm(false);
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

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingNew(true);
    setSubmitResult(null);
    try {
      const res = await fetch('/api/business/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitResult({
          success: true,
          message: data.message || 'Your business has been submitted for review!',
        });
        setShowNewForm(false);
        setNewForm({ name: '', address: '', city_id: '', category_id: '', description: '', phone: '', website: '', contactName: '', contactEmail: '' });
        const claimsRes = await fetch('/api/business/claim');
        const claimsData = await claimsRes.json();
        setExistingClaims(claimsData.claims || []);
      } else {
        setSubmitResult({ success: false, message: data.error || 'Failed to submit business' });
      }
    } catch {
      setSubmitResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const openNewForm = () => {
    setShowNewForm(true);
    setSelectedEstablishment(null);
    setSubmitResult(null);
    // Pre-fill search query as business name
    if (searchQuery.trim()) {
      setNewForm(prev => ({ ...prev, name: searchQuery.trim() }));
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
                  {claim.status === 'approved' ? 'Approved' : claim.status === 'pending' ? 'Pending Review' : 'Rejected'}
                </span>
              </div>
            ))}
          </div>
          {existingClaims.some(c => c.status === 'approved') && (
            <Link
              href="/business"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Go to Business Dashboard &rarr;
            </Link>
          )}
        </div>
      )}

      {/* Success/Error Message */}
      {submitResult && (
        <div className={`mb-6 p-4 rounded-lg ${
          submitResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <p className="font-medium">{submitResult.success ? 'Submitted Successfully!' : 'Error'}</p>
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
            placeholder="Search by business name..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || searchQuery.trim().length < 2}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Always-visible "Add a New Business" link */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">Don&apos;t see your business listed?</p>
          <button
            onClick={openNewForm}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
          >
            + Add a New Business
          </button>
        </div>
      </div>

      {/* Search Results */}
      {hasSearched && !isSearching && !selectedEstablishment && !showNewForm && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Search Results ({searchResults.length})
          </h3>
          {searchResults.length > 0 ? (
            <>
              <div className="space-y-3">
                {searchResults.map(est => (
                  <div
                    key={est.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer"
                    onClick={() => handleSelectEstablishment(est)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{est.name}</p>
                      <p className="text-sm text-gray-500">{est.address}</p>
                      {est.categories && (
                        <span className="text-xs text-gray-400">{est.categories.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {est.isClaimed && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Already Claimed</span>
                      )}
                      <span className="text-orange-600 text-sm font-medium">Select &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* CTA after results */}
              <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500 mb-2">Can&apos;t find your business in the results?</p>
                <button
                  onClick={openNewForm}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
                >
                  + Add Your Business to Paw Cities
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No establishments found matching &quot;{searchQuery}&quot;</p>
              <button
                onClick={openNewForm}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
              >
                + Add Your Business to Paw Cities
              </button>
            </div>
          )}
        </div>
      )}

      {/* Claim Form for existing establishment */}
      {selectedEstablishment && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Claim: {selectedEstablishment.name}</h3>
            <button
              onClick={() => setSelectedEstablishment(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back to results
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6">{selectedEstablishment.address}</p>

          <form onSubmit={handleSubmitClaim} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                value={claimForm.businessName}
                onChange={(e) => setClaimForm(prev => ({ ...prev, businessName: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={claimForm.contactName}
                  onChange={(e) => setClaimForm(prev => ({ ...prev, contactName: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={claimForm.contactEmail}
                  onChange={(e) => setClaimForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={claimForm.contactPhone}
                onChange={(e) => setClaimForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
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
        </div>
      )}

      {/* New Business Form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Add New Business</h3>
            <button
              onClick={() => setShowNewForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back to search
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Submit your business to be listed on Paw Cities. We&apos;ll review your submission and get back to you within 1-2 business days.
          </p>

          <form onSubmit={handleSubmitNew} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={(e) => setNewForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input
                  type="text"
                  value={newForm.address}
                  onChange={(e) => setNewForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <select
                  value={newForm.city_id}
                  onChange={(e) => setNewForm(prev => ({ ...prev, city_id: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                >
                  <option value="">Select a city</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={newForm.category_id}
                  onChange={(e) => setNewForm(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newForm.description}
                onChange={(e) => setNewForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Describe your business and how it's dog-friendly..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newForm.phone}
                  onChange={(e) => setNewForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={newForm.website}
                  onChange={(e) => setNewForm(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={newForm.contactName}
                  onChange={(e) => setNewForm(prev => ({ ...prev, contactName: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Email *</label>
                <input
                  type="email"
                  value={newForm.contactEmail}
                  onChange={(e) => setNewForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmittingNew}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {isSubmittingNew ? 'Submitting...' : 'Submit New Business'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-6 py-2.5 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Info Section */}
      {!selectedEstablishment && !showNewForm && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border p-6 text-center">
            <div className="text-3xl mb-3">&#128269;</div>
            <h3 className="font-semibold text-gray-900 mb-1">1. Find Your Business</h3>
            <p className="text-sm text-gray-600">Search for your establishment or add a new one</p>
          </div>
          <div className="bg-white rounded-xl border p-6 text-center">
            <div className="text-3xl mb-3">&#128221;</div>
            <h3 className="font-semibold text-gray-900 mb-1">2. Submit Your Claim</h3>
            <p className="text-sm text-gray-600">Claim an existing listing or create a new one</p>
          </div>
          <div className="bg-white rounded-xl border p-6 text-center">
            <div className="text-3xl mb-3">&#128640;</div>
            <h3 className="font-semibold text-gray-900 mb-1">3. Start Managing</h3>
            <p className="text-sm text-gray-600">Once approved, manage your listing and grow your business</p>
          </div>
        </div>
      )}
    </div>
  );
}

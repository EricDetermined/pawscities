'use client';

import React, { useState, useEffect } from 'react';
import { CITIES, CATEGORIES } from '@/lib/cities-config';

interface ValidationItem {
  id: string;
  name: string;
  nameFr?: string;
  category: string;
  address: string;
  city: string;
  description: string;
  dogFeatures: Record<string, boolean>;
  confidence: number;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected';
  source: string;
  createdAt: string;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function ValidationQueuePage() {
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [selectedItem, setSelectedItem] = useState<ValidationItem | null>(null);
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Load validation queue
  useEffect(() => {
    loadQueue();
  }, [filter, cityFilter]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (cityFilter !== 'all') params.set('city', cityFilter);

      const response = await fetch(`/api/admin/validation?${params}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load validation queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/validation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        setItems(prev =>
          prev.map(item =>
            item.id === id ? { ...item, status: 'approved' } : item
          )
        );
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/validation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (response.ok) {
        setItems(prev =>
          prev.map(item =>
            item.id === id ? { ...item, status: 'rejected' } : item
          )
        );
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCategoryIcon = (slug: string) => {
    const category = CATEGORIES.find(c => c.slug === slug);
    return category?.icon || '📍';
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const rejectedCount = items.filter(i => i.status === 'rejected').length;

  const filteredItems = items.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (cityFilter !== 'all' && item.city !== cityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">✅ Validation Queue</h1>
          <p className="text-gray-600 mt-1">
            Review and approve AI-discovered establishments
          </p>
        </div>

        <button
          onClick={loadQueue}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
          <div className="text-sm text-gray-600">Pending Review</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-green-600">{approvedCount}</div>
          <div className="text-sm text-gray-600">Approved</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
          <div className="text-sm text-gray-600">Rejected</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-gray-900">{items.length}</div>
          <div className="text-sm text-gray-600">Total Items</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map(
              status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === status
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all'
                    ? 'All'
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              )
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg"
          >
            <option value="all">All Cities</option>
            {Object.entries(CITIES).map(([slug, city]) => (
              <option key={slug} value={slug}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Queue List */}
      <div className="bg-white rounded-xl shadow-sm border">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <svg
              className="animate-spin h-8 w-8 mx-auto mb-2"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading validation queue...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-4xl mb-2">📭</p>
            <p>No items in queue matching your filters.</p>
            <p className="text-sm mt-2">
              Run the Research Agent to discover new places!
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedItem?.id === item.id ? 'bg-primary-50' : ''
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {getCategoryIcon(item.category)}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-600">{item.address}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {CITIES[item.city]?.name || item.city}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-500">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(
                        item.confidence
                      )}`}
                    >
                      {item.confidence}% confidence
                    </span>

                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {getCategoryIcon(selectedItem.category)} {selectedItem.name}
                  </h2>
                  <p className="text-gray-600">{selectedItem.address}</p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Confidence Score */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">
                  AI Confidence Score
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        selectedItem.confidence >= 80
                          ? 'bg-green-500'
                          : selectedItem.confidence >= 60
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${selectedItem.confidence}%` }}
                    />
                  </div>
                  <span className="font-bold text-lg">
                    {selectedItem.confidence}%
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedItem.reasoning}
                </p>
              </div>

              {/* Description */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-gray-600">{selectedItem.description}</p>
              </div>

              {/* Dog Features */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">
                  Dog-Friendly Features
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedItem.dogFeatures).map(
                    ([feature, enabled]) =>
                      enabled && (
                        <span
                          key={feature}
                          className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                        >
                          {feature === 'waterBowl' && '💧 Water Bowl'}
                          {feature === 'treats' && '🦴 Treats'}
                          {feature === 'outdoorSeating' && '☀️ Outdoor Seating'}
                          {feature === 'indoorAllowed' && '🏠 Indoor Allowed'}
                          {feature === 'offLeashArea' && '🐕 Off-Leash Area'}
                          {feature === 'dogMenu' && '🍖 Dog Menu'}
                          {feature === 'fenced' && '🔒 Fenced'}
                          {feature === 'shadeAvailable' && '🌳 Shade'}
                        </span>
                      )
                  )}
                </div>
              </div>

              {/* Meta Info */}
              <div className="text-sm text-gray-500 space-y-1">
                <p>Source: {selectedItem.source}</p>
                <p>
                  Added: {new Date(selectedItem.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              {selectedItem.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleApprove(selectedItem.id)}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    ✅ Approve & Add to Database
                  </button>
                  <button
                    onClick={() => handleReject(selectedItem.id)}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                  >
                    ❌ Reject
                  </button>
                </div>
              )}

              {selectedItem.status !== 'pending' && (
                <div className="pt-4 border-t text-center">
                  <span
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      selectedItem.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {selectedItem.status === 'approved'
                      ? '✅ Already Approved'
                      : '❌ Already Rejected'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

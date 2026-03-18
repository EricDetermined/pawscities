'use client';

import React from 'react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Platform configuration and preferences</p>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">General</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Site Name</p>
              <p className="text-sm text-gray-500">The name displayed across the platform</p>
            </div>
            <p className="text-gray-700">Paw Cities</p>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Domain</p>
              <p className="text-sm text-gray-500">Primary domain for the platform</p>
            </div>
            <p className="text-gray-700">pawcities.com</p>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Platform Version</p>
              <p className="text-sm text-gray-500">Current deployment version</p>
            </div>
            <p className="text-gray-700">v1.0 - Phase 2</p>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Launch Cities</p>
              <p className="text-sm text-gray-500">Number of active cities</p>
            </div>
            <p className="text-gray-700">8 cities</p>
          </div>
        </div>
      </div>

      {/* API Integrations */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Integrations</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Google Places API</p>
              <p className="text-sm text-gray-500">Enrichment and photo proxying</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Connected</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Instagram / Meta Graph API</p>
              <p className="text-sm text-gray-500">Auto-posting to @ThePawCities</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Connected</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Stripe</p>
              <p className="text-sm text-gray-500">Business subscriptions and payments</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Connected</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Supabase</p>
              <p className="text-sm text-gray-500">Database and authentication</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Connected</span>
          </div>
        </div>
      </div>

      {/* Scheduled Tasks */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Scheduled Tasks</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Instagram Auto-Post</p>
              <p className="text-sm text-gray-500">Mon/Wed/Fri at 2:00 PM UTC</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Google Places Re-Enrichment</p>
              <p className="text-sm text-gray-500">1st and 15th of every month at 9:00 AM</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

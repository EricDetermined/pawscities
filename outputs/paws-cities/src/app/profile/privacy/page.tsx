'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { AlertCircle, Download, Trash2, Shield } from 'lucide-react';

interface ConsentData {
  userId: string;
  email: string;
  consents: Array<{
    type: 'necessary' | 'analytics' | 'marketing';
    consented: boolean;
    timestamp: string;
  }>;
}

export default function PrivacyPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [consents, setConsents] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/auth/login'); return; }
    loadConsents();
  }, [user, isLoading, router]);

  const loadConsents = async () => {
    try {
      const response = await fetch('/api/gdpr/consent');
      if (response.ok) {
        const data = await response.json();
        setConsents(data);
      } else {
        setMessage({ type: 'error', text: 'Failed to load consent preferences' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading consent preferences' });
      console.error('Error loading consents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConsentChange = async (type: 'analytics' | 'marketing', value: boolean) => {
    if (!consents) return;
    setSaving(true);
    try {
      const response = await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analytics: type === 'analytics' ? value : consents.consents.find(c => c.type === 'analytics')?.consented,
          marketing: type === 'marketing' ? value : consents.consents.find(c => c.type === 'marketing')?.consented,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setConsents(data);
        setMessage({ type: 'success', text: 'Consent preferences updated' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to update consent' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error updating consent' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch('/api/gdpr/export');
      if (response.ok) {
        const disposition = response.headers.get('content-disposition');
        const filename = disposition?.split('filename="')[1]?.split('"')[0] || 'pawscities-export.json';
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Your data has been downloaded' });
      } else {
        setMessage({ type: 'error', text: 'Failed to export data' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error exporting data' });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE_MY_ACCOUNT') {
      setMessage({ type: 'error', text: 'Please confirm with the correct text' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/gdpr/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE_MY_ACCOUNT' }),
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Account deletion initiated. You will be logged out.' });
        setTimeout(() => { fetch('/api/auth/logout').then(() => { router.push('/'); }); }, 2000);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete account' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error deleting account' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 rounded w-48"></div>
            <div className="space-y-4"><div className="h-32 bg-gray-200 rounded"></div><div className="h-32 bg-gray-200 rounded"></div></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy & Data Settings</h1>
          <p className="text-gray-600">Manage your data, consent preferences, and privacy settings</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Export */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3"><Download className="w-5 h-5 text-orange-500" /><h2 className="text-lg font-semibold text-gray-900">Export Your Data</h2></div>
              <p className="text-sm text-gray-600 mt-1">Download a copy of all your personal data in JSON format (GDPR Article 20)</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">Download all your data including profile, dogs, reviews, favorites, and activity history.</p>
              <button onClick={handleExportData} disabled={saving} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors">{saving ? 'Exporting...' : 'Download My Data'}</button>
            </div>
          </div>

          {/* Consent */}
          {consents && (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-orange-500" /><h2 className="text-lg font-semibold text-gray-900">Cookie & Consent Preferences</h2></div>
                <p className="text-sm text-gray-600 mt-1">Manage which cookies and tracking technologies we can use</p>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between"><div><h3 className="font-medium text-gray-900">Necessary Cookies</h3><p className="text-sm text-gray-600 mt-1">Essential for site functionality</p></div><div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">Always On</div></div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between"><div><h3 className="font-medium text-gray-900">Analytics Cookies</h3><p className="text-sm text-gray-600 mt-1">Help us understand how you use PawsCities</p></div>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={consents.consents.find(c => c.type === 'analytics')?.consented || false} onChange={(e) => handleConsentChange('analytics', e.target.checked)} disabled={saving} className="w-4 h-4 rounded border-gray-300 text-orange-500" /><span className="text-sm text-gray-600">{consents.consents.find(c => c.type === 'analytics')?.consented ? 'Enabled' : 'Disabled'}</span></label>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between"><div><h3 className="font-medium text-gray-900">Marketing Cookies</h3><p className="text-sm text-gray-600 mt-1">Personalize content based on your interests</p></div>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={consents.consents.find(c => c.type === 'marketing')?.consented || false} onChange={(e) => handleConsentChange('marketing', e.target.checked)} disabled={saving} className="w-4 h-4 rounded border-gray-300 text-orange-500" /><span className="text-sm text-gray-600">{consents.consents.find(c => c.type === 'marketing')?.consented ? 'Enabled' : 'Disabled'}</span></label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="bg-white rounded-lg shadow border border-red-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 bg-red-50">
              <div className="flex items-center gap-3"><Trash2 className="w-5 h-5 text-red-500" /><h2 className="text-lg font-semibold text-gray-900">Delete Account</h2></div>
              <p className="text-sm text-gray-600 mt-1">Permanently delete your account and personal data (GDPR Article 17)</p>
            </div>
            <div className="px-6 py-4">
              {!showDeleteConfirm ? (
                <div><p className="text-sm text-gray-600 mb-4">Deleting your account is permanent and cannot be undone. Your reviews will be anonymized but retained.</p>
                  <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">Delete My Account</button></div>
              ) : (
                <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-gray-900">To confirm deletion, type <span className="font-mono text-red-600">DELETE_MY_ACCOUNT</span></p>
                  <input type="text" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder="DELETE_MY_ACCOUNT" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <div className="flex gap-3">
                    <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmation(''); }} disabled={saving} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
                    <button onClick={handleDeleteAccount} disabled={saving || deleteConfirmation !== 'DELETE_MY_ACCOUNT'} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg transition-colors">{saving ? 'Deleting...' : 'Delete Account'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900"><strong>Note:</strong> You have the right to access, rectify, and delete your personal data under GDPR. For more information, see our <a href="/privacy" className="underline hover:text-blue-700">Privacy Policy</a>. Contact support@pawscities.com for complete data erasure or other requests.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

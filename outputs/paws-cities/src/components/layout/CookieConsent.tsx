'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [consents, setConsents] = useState({
    necessary: true, // Always true, non-optional
    analytics: false,
    marketing: false,
  });
  const { user } = useAuth();

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent-v2');
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    } else {
      try {
        const parsed = JSON.parse(consent);
        setConsents(parsed);
      } catch {
        setShowBanner(true);
      }
    }
  }, []);

  const handleAcceptAll = async () => {
    const newConsents = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    await saveConsents(newConsents);
    setConsents(newConsents);
    setShowBanner(false);
  };

  const handleDeclineAll = async () => {
    const newConsents = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    await saveConsents(newConsents);
    setConsents(newConsents);
    setShowBanner(false);
  };

  const handleSavePreferences = async () => {
    await saveConsents(consents);
    setShowBanner(false);
    setShowDetails(false);
  };

  const saveConsents = async (newConsents: typeof consents) => {
    // Save to localStorage
    localStorage.setItem('cookie-consent-v2', JSON.stringify(newConsents));
    localStorage.setItem('cookie-consent-timestamp', new Date().toISOString());

    // If user is authenticated, save to database
    if (user) {
      try {
        await fetch('/api/gdpr/consent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            analytics: newConsents.analytics,
            marketing: newConsents.marketing,
          }),
        });
      } catch (error) {
        console.error('Failed to save consent preferences:', error);
      }
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Main Banner */}
        {!showDetails && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Cookie & Privacy Preferences</h3>
              <p className="text-sm text-gray-600 mb-4">
                We use cookies and similar technologies to improve your experience. We use{' '}
                <strong>necessary</strong> cookies for essential functionality, plus <strong>analytics</strong> and{' '}
                <strong>marketing</strong> cookies (if you consent).{' '}
                <Link href="/privacy" className="text-orange-600 hover:underline">
                  Learn more
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setShowDetails(true)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors whitespace-nowrap"
              >
                Manage Preferences
              </button>
              <button
                onClick={handleDeclineAll}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors whitespace-nowrap"
              >
                Decline All
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors whitespace-nowrap"
              >
                Accept All
              </button>
            </div>
          </div>
        )}

        {/* Details Panel */}
        {showDetails && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Cookie Preferences</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Necessary Cookies */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">Necessary Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Essential for website functionality. These cannot be disabled.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="w-4 h-4 rounded border-gray-300 text-orange-500"
                  />
                  <span className="text-sm text-gray-600">Always On</span>
                </div>
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">Analytics Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Help us understand how you use PawsCities to improve our service.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.analytics}
                    onChange={(e) => setConsents({ ...consents, analytics: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500"
                  />
                  <span className="text-sm text-gray-600">{consents.analytics ? 'On' : 'Off'}</span>
                </label>
              </div>
            </div>

            {/* Marketing Cookies */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">Marketing Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Personalize content and ads based on your interests.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.marketing}
                    onChange={(e) => setConsents({ ...consents, marketing: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500"
                  />
                  <span className="text-sm text-gray-600">{consents.marketing ? 'On' : 'Off'}</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleDeclineAll}
                className="flex-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 px-4 py-2 text-sm text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

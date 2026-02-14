'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function UpgradeSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Brief loading state for visual feedback
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4" />
        <p className="text-gray-600">Confirming your subscription...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Welcome to Premium!
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Your subscription is now active. You have access to all premium features for your listing.
        </p>

        {/* What's Unlocked */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 mb-8 text-left">
          <h2 className="font-semibold text-gray-900 mb-4 text-center">What&apos;s Now Unlocked</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Priority search placement',
              'Respond to customer reviews',
              'Business hours display',
              'Website link on listing',
              'Photo gallery (up to 20)',
              'Special offers & promotions',
              'Monthly analytics report',
              'Premium badge on listing',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div className="space-y-3 mb-8">
          <h3 className="font-medium text-gray-900">Recommended Next Steps</h3>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/business/listing"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              Update Your Listing
            </Link>
            <Link
              href="/business"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Session ID: {sessionId || 'N/A'} &middot; Your receipt has been sent to your email.
        </p>
      </div>
    </div>
  );
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div>}>
      <UpgradeSuccessContent />
    </Suspense>
  );
}

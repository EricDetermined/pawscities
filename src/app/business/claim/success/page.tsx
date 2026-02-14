'use client';

import Link from 'next/link';

const FREE_FEATURES = [
  'Basic business listing',
  'Appear in search results',
  'View listing analytics (limited)',
  'Receive customer check-ins',
  'Display business hours & address',
];

const BRONZE_FEATURES = [
  'Everything in Free, plus:',
  'Respond to all reviews',
  'Enhanced listing badge',
  'Priority in local search',
  'Weekly performance reports',
  'Add photos & menu/services',
  'Special offers & promotions',
];

const SILVER_HIGHLIGHTS = [
  'Featured in city guides',
  'Top placement in category',
  'Advanced analytics dashboard',
  'Event creation & promotion',
  'Custom branding on listing',
  'Monthly spotlight feature',
  'Priority support',
];

export default function ClaimSuccessPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Success Banner */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Claim Submitted!</h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Your business claim is now under review. We&apos;ll verify your information and notify you within 1&ndash;2 business days.
        </p>
      </div>

      {/* What Happens Next */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">What Happens Next</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-sm">1</div>
            <div>
              <p className="font-medium text-gray-900">Verification Review</p>
              <p className="text-sm text-gray-500">Our team reviews your submitted information and verification documents.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-sm">2</div>
            <div>
              <p className="font-medium text-gray-900">Claim Approved</p>
              <p className="text-sm text-gray-500">Once verified, you&apos;ll get full access to manage your business listing.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-sm">3</div>
            <div>
              <p className="font-medium text-gray-900">Start Growing</p>
              <p className="text-sm text-gray-500">Edit your listing, respond to reviews, and attract more dog owners.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade CTA - Main Upsell */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 p-8 mb-8">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full mb-3">RECOMMENDED</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Get More From Your Listing</h2>
          <p className="text-gray-600 max-w-lg mx-auto">
            While you wait for approval, explore how upgrading to Bronze can help you stand out and attract more customers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Free Plan */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Free</h3>
                <p className="text-2xl font-bold text-gray-900">$0<span className="text-sm font-normal text-gray-500">/mo</span></p>
              </div>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Current Plan</span>
            </div>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Bronze Plan */}
          <div className="bg-white rounded-lg border-2 border-orange-300 p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">BEST VALUE</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Bronze</h3>
                <p className="text-2xl font-bold text-orange-600">$29<span className="text-sm font-normal text-gray-500">/mo</span></p>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              {BRONZE_FEATURES.map((f, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${i === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                  <svg className={`w-4 h-4 ${i === 0 ? 'text-orange-500' : 'text-orange-400'} mt-0.5 flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/business/upgrade"
              className="block w-full text-center px-4 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              View All Plans
            </Link>
          </div>
        </div>

        {/* Silver Teaser */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">Want even more visibility?</p>
          <p className="text-sm text-gray-600">
            Our <span className="font-semibold text-gray-800">Silver plan ($79/mo)</span> includes city guide features, top category placement, and advanced analytics.{' '}
            <Link href="/business/upgrade" className="text-orange-600 hover:text-orange-700 font-medium">
              Compare all plans &rarr;
            </Link>
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/business"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border hover:border-orange-300 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">Go to Dashboard</p>
            <p className="text-sm text-gray-500">View your business overview and stats</p>
          </div>
        </Link>

        <Link
          href="/business/claim"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border hover:border-orange-300 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">Claim Another Business</p>
            <p className="text-sm text-gray-500">Have multiple locations? Claim them all</p>
          </div>
        </Link>
      </div>

      {/* Social Proof / Trust */}
      <div className="text-center text-sm text-gray-400 mb-8">
        <p>Join hundreds of dog-friendly businesses already growing with Paw Cities.</p>
      </div>
    </div>
  );
}

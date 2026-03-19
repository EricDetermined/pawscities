'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TierBadge } from '@/components/business/TierBadge';

interface DashboardData {
  status: string;
  establishment: {
    id: string;
    name: string;
    tier: string;
  } | null;
  subscription: {
    tier: string;
    isPremium: boolean;
  } | null;
}

const features = [
  {
    category: 'Listing',
    free: ['Basic listing', 'Description'],
    premium: [
      'Enhanced description',
      'Custom website field',
      'Opening hours',
    ],
  },
  {
    category: 'Photos',
    free: ['1 photo'],
    premium: ['Up to 10 photos', 'Featured placement'],
  },
  {
    category: 'Visibility',
    free: ['Search results', 'Dog features shown'],
    premium: [
      'Featured placement',
      'Priority in search',
      'Verified badge',
      'Premium badge',
    ],
  },
  {
    category: 'Customer Engagement',
    free: ['View reviews', 'Read comments'],
    premium: [
      'Respond to reviews',
      'Direct booking link',
      'Contact analytics',
    ],
  },
  {
    category: 'Analytics',
    free: ['Basic stats'],
    premium: [
      '30-day analytics',
      'Click tracking',
      'Phone/website clicks',
      'Direction clicks',
      'Peak hours analysis',
    ],
  },
];

function UpgradePageContent() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/business/dashboard');
        if (!response.ok) throw new Error('Failed to load');
        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const handleCheckout = async () => {
    if (!dashboard?.establishment?.id) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: billingPeriod,
          establishmentId: dashboard.establishment.id,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  const tier = dashboard?.subscription?.tier || 'free';
  const isPremium = dashboard?.subscription?.isPremium || false;

  return (
    <div>
      {/* Canceled Banner */}
      {canceled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-center">
          <p className="text-yellow-800">Checkout was canceled. You can try again whenever you&apos;re ready.</p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Upgrade Your Listing
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Unlock powerful features to grow your dog-friendly business
        </p>
        <div className="flex justify-center gap-4">
          <TierBadge tier={tier as 'free' | 'premium'} />
        </div>
      </div>

      {/* Billing Toggle */}
      {!isPremium && (
        <div className="flex justify-center items-center gap-4 mb-10">
          <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              billingPeriod === 'annual' ? 'bg-orange-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingPeriod === 'annual' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${billingPeriod === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}>
            Annual
          </span>
          {billingPeriod === 'annual' && (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              Save $99/yr
            </span>
          )}
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
        {/* Free Plan */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
          <p className="text-gray-600 mb-6">Perfect to get started</p>
          <div className="mb-6">
            <p className="text-4xl font-bold text-gray-900">$0</p>
            <p className="text-gray-600 text-sm">/month</p>
          </div>

          <button
            disabled
            className="w-full px-4 py-2 mb-8 bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-75"
          >
            {!isPremium ? 'Current Plan' : 'Free Tier'}
          </button>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Includes:</h4>
            <ul className="space-y-2">
              {['Basic business listing', '1 photo', 'Dog features display', 'View reviews and ratings'].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5">&#10003;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Premium Plan */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border-2 border-orange-500 p-8 relative">
          <div className="absolute top-0 right-0 bg-orange-500 text-white px-4 py-1 rounded-bl-lg text-sm font-semibold">
            Most Popular
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium</h3>
          <p className="text-gray-600 mb-6">For serious businesses</p>
          <div className="mb-6">
            {billingPeriod === 'monthly' ? (
              <>
                <p className="text-4xl font-bold text-orange-600">$29</p>
                <p className="text-gray-600 text-sm">/month</p>
              </>
            ) : (
              <>
                <p className="text-4xl font-bold text-orange-600">$249</p>
                <p className="text-gray-600 text-sm">/year <span className="text-green-600 font-medium">($20.75/mo)</span></p>
              </>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={isPremium || checkoutLoading}
            className="w-full px-4 py-2 mb-8 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-75"
          >
            {isPremium
              ? 'Current Plan'
              : checkoutLoading
                ? 'Redirecting...'
                : `Upgrade to Premium`}
          </button>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Everything in Free, plus:</h4>
            <ul className="space-y-2">
              {[
                'Up to 10 photos',
                'Featured search placement',
                'Verified & Premium badges',
                'Respond to reviews',
                'Detailed analytics (30 days)',
                'Click tracking & insights',
                'Direct booking link',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-orange-500 mt-0.5">&#10003;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Detailed Comparison */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Detailed Feature Comparison
        </h2>

        <div className="space-y-8">
          {features.map((section) => (
            <div key={section.category}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {section.category}
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Free</h4>
                  <ul className="space-y-2">
                    {section.free.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">&#10003;</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Premium</h4>
                  <ul className="space-y-2">
                    {section.premium.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-orange-500 mt-0.5">&#10003;</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-gray-50 rounded-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">FAQ</h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">How does billing work?</h3>
            <p className="text-gray-700">
              Choose monthly ($29/mo) or annual ($249/yr - save $99). You can cancel anytime without penalty.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Can I cancel my subscription?</h3>
            <p className="text-gray-700">
              Yes! You can cancel your Premium subscription at any time. Your listing will revert to the Free plan with all core features intact.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
            <p className="text-gray-700">
              We accept all major credit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, and other digital payment methods through Stripe.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Can I switch between monthly and annual?</h3>
            <p className="text-gray-700">
              Yes! You can switch between billing periods at any time. If upgrading to annual, you&apos;ll receive a prorated credit for any remaining monthly time.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What if I need help?</h3>
            <p className="text-gray-700">
              Our support team is here to help! Email us at{' '}
              <a href="mailto:eric@pawcities.com" className="text-orange-600 hover:text-orange-700 font-medium">
                eric@pawcities.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/business"
          className="inline-block px-6 py-3 text-orange-600 hover:text-orange-700 font-medium"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    }>
      <UpgradePageContent />
    </Suspense>
  );
}

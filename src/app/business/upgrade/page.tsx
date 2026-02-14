'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TierBadge } from '@/components/business/TierBadge';

interface Subscription {
  tier: 'free' | 'premium';
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

export default function UpgradePage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/business/dashboard');
        if (!response.ok) {
          throw new Error('Failed to load subscription');
        }
        const data = await response.json();
        setSubscription(data.subscription);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  if (loading) {
    const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, establishmentId: subscription?.establishmentId }),
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

  return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const tier = subscription?.tier || 'free';

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Upgrade Your Listing
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Unlock powerful features to grow your business
        </p>
        <div className="flex justify-center gap-4">
          <TierBadge tier={tier} />
        </div>
      </div>

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
            disabled={tier === 'free'}
            className="w-full px-4 py-2 mb-8 bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-75"
          >
            {tier === 'free' ? '✓ Current Plan' : 'Downgrade'}
          </button>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Includes:</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Basic business listing</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>1 photo</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Dog features display</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>View reviews and ratings</span>
              </li>
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
            <p className="text-4xl font-bold text-orange-600">$29</p>
            <p className="text-gray-600 text-sm">/month</p>
          </div>

          <button
            onClick={() => handleCheckout('bronze')}
            disabled={tier === 'premium' || checkoutLoading}
            className="w-full px-4 py-2 mb-8 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-75"
          >
            {tier === 'premium'
              ? '✓ Current Plan'
              : 'Upgrade to Premium'}
          </button>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Everything in Free, plus:</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Up to 10 photos</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Featured search placement</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Verified & Premium badges</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Respond to reviews</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Detailed analytics (30 days)</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Click tracking & insights</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Direct booking link</span>
              </li>
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
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Free
                  </h4>
                  <ul className="space-y-2">
                    {section.free.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Premium
                  </h4>
                  <ul className="space-y-2">
                    {section.premium.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <span className="text-orange-500 mt-0.5">✓</span>
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
            <h3 className="font-semibold text-gray-900 mb-2">
              How does billing work?
            </h3>
            <p className="text-gray-700">
              Premium plans are billed monthly at $29/month. You can cancel
              anytime without penalty.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Can I cancel my subscription?
            </h3>
            <p className="text-gray-700">
              Yes! You can cancel your Premium subscription at any time. Your
              listing will revert to the Free plan with all core features intact.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              What payment methods do you accept?
            </h3>
            <p className="text-gray-700">
              We accept all major credit cards (Visa, Mastercard, American
              Express) and other digital payment methods.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Is there a free trial?
            </h3>
            <p className="text-gray-700">
              Yes! Start with our Free plan and upgrade anytime. No credit card
              required to get started.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              What if I need help?
            </h3>
            <p className="text-gray-700">
              Our support team is here to help! Email us at{' '}
              <a
                href="mailto:business@pawcities.com"
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                business@pawcities.com
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
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

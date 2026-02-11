'use client';

import { useState, useEffect } from 'react';
import { TierBadge } from '@/components/business/TierBadge';

interface Subscription {
  tier: 'free' | 'premium';
}

export default function PhotosPage() {
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
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Failed to load subscription
      </div>
    );
  }

  const tier = subscription.tier;
  const maxPhotos = tier === 'premium' ? 10 : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Photos</h1>
          <p className="text-gray-600">
            Upload up to {maxPhotos} photo{maxPhotos !== 1 ? 's' : ''} to showcase
            your business
          </p>
        </div>
        <TierBadge tier={tier} />
      </div>

      <div className="bg-white rounded-lg p-8 border border-gray-200 text-center">
        <div className="text-5xl mb-4">📸</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Photo Management Coming Soon
        </h2>
        <p className="text-gray-600 mb-6">
          We're currently building the photo upload feature. You'll be able to
          upload high-quality images of your business, interior, outdoor areas,
          and dogs enjoying your space.
        </p>
        <div className="inline-block bg-orange-100 text-orange-700 px-4 py-2 rounded-lg">
          <p className="font-medium">
            {tier === 'free'
              ? 'Free plan: 1 photo'
              : 'Premium plan: up to 10 photos'}
          </p>
        </div>
      </div>
    </div>
  );
}

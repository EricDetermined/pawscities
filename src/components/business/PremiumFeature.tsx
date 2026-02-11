'use client';

import Link from 'next/link';

interface PremiumFeatureProps {
  tier: 'free' | 'premium';
  feature: string;
  children: React.ReactNode;
}

export function PremiumFeature({ tier, feature, children }: PremiumFeatureProps) {
  if (tier === 'premium') {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
        <div className="bg-white rounded-lg shadow-xl p-6 text-center max-w-sm">
          <div className="text-3xl mb-2">🔒</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unlock {feature}
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Upgrade to Premium to access this feature
          </p>
          <Link
            href="/business/upgrade"
            className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}

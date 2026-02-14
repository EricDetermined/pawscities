'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

export type SubscriptionTier = 'FREE' | 'BRONZE' | 'SILVER' | 'GOLD';

const TIER_LEVEL: Record<SubscriptionTier, number> = {
  FREE: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};

interface FeatureGateProps {
  children: ReactNode;
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  featureName: string;
  compact?: boolean;
}

export function FeatureGate({
  children,
  currentTier,
  requiredTier,
  featureName,
  compact = false,
}: FeatureGateProps) {
  const hasAccess = TIER_LEVEL[currentTier] >= TIER_LEVEL[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (compact) {
    return (
      <div className="relative group">
        <div className="opacity-40 pointer-events-none select-none blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Link
            href="/business/upgrade"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 border border-orange-200 rounded-full text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {requiredTier}+
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6">
      <div className="opacity-30 pointer-events-none select-none blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 text-center">{featureName}</p>
        <p className="text-sm text-gray-500 text-center mt-1 mb-3">
          Available on {requiredTier} plan and above
        </p>
        <Link
          href="/business/upgrade"
          className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
        >
          Upgrade to Unlock
        </Link>
      </div>
    </div>
  );
}

interface TierBadgeProps {
  tier: SubscriptionTier;
  size?: 'sm' | 'md';
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const colors: Record<SubscriptionTier, string> = {
    FREE: 'bg-gray-100 text-gray-600',
    BRONZE: 'bg-orange-100 text-orange-700',
    SILVER: 'bg-slate-100 text-slate-700',
    GOLD: 'bg-yellow-100 text-yellow-700',
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${colors[tier]} ${sizeClasses}`}>
      {tier}
    </span>
  );
}

export function hasFeatureAccess(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_LEVEL[currentTier] >= TIER_LEVEL[requiredTier];
}

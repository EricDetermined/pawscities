/**
 * ListingBadges - Premium indicators for public establishment pages
 * 
 * Usage:
 *   import { ListingBadges, PremiumCard } from '@/components/ListingBadges';
 * 
 *   // In establishment detail hero:
 *   <ListingBadges tier={place.tier} isClaimed={place.isClaimed} />
 * 
 *   // On establishment cards in city listing:
 *   <PremiumCard tier={place.tier} />
 */

export type ListingTier = 'FREE' | 'CLAIMED' | 'PREMIUM';

interface ListingBadgesProps {
  tier: ListingTier | string;
  isClaimed?: boolean;
  size?: 'sm' | 'md';
}

/** Full badge row for establishment detail pages */
export function ListingBadges({ tier, isClaimed, size = 'md' }: ListingBadgesProps) {
  const normalizedTier = (tier || 'FREE').toUpperCase() as ListingTier;
  const isSmall = size === 'sm';
  const iconSize = isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = isSmall ? 'text-xs' : 'text-sm';
  const padding = isSmall ? 'px-2 py-0.5' : 'px-3 py-1';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Verified / Claimed badge */}
      {(isClaimed || normalizedTier !== 'FREE') && (
        <span className={`inline-flex items-center gap-1 ${padding} bg-blue-50 text-blue-700 ${textSize} font-medium rounded-full border border-blue-200`}>
          <svg className={`${iconSize}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Verified Business
        </span>
      )}

      {/* Premium badge */}
      {normalizedTier === 'PREMIUM' && (
        <span className={`inline-flex items-center gap-1 ${padding} bg-gradient-to-r from-amber-50 to-orange-50 text-orange-700 ${textSize} font-semibold rounded-full border border-orange-200`}>
          <svg className={`${iconSize}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Premium Partner
        </span>
      )}

      {/* Featured badge - for premium listings */}
      {normalizedTier === 'PREMIUM' && (
        <span className={`inline-flex items-center gap-1 ${padding} bg-purple-50 text-purple-700 ${textSize} font-medium rounded-full border border-purple-200`}>
          <svg className={`${iconSize}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Featured
        </span>
      )}
    </div>
  );
}

interface PremiumCardProps {
  tier: ListingTier | string;
}

/** Small indicator overlay for establishment cards in city listings */
export function PremiumCard({ tier }: PremiumCardProps) {
  const normalizedTier = (tier || 'FREE').toUpperCase() as ListingTier;

  if (normalizedTier === 'FREE') return null;

  if (normalizedTier === 'PREMIUM') {
    return (
      <div className="absolute top-2 right-2 z-10">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full shadow-sm">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          PREMIUM
        </span>
      </div>
    );
  }

  if (normalizedTier === 'CLAIMED') {
    return (
      <div className="absolute top-2 right-2 z-10">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full shadow-sm">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          VERIFIED
        </span>
      </div>
    );
  }

  return null;
}

/** Inline premium indicator for search results */
export function PremiumInline({ tier }: PremiumCardProps) {
  const normalizedTier = (tier || 'FREE').toUpperCase() as ListingTier;

  if (normalizedTier === 'PREMIUM') {
    return (
      <span className="inline-flex items-center gap-0.5 text-orange-500 text-xs font-semibold">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Premium
      </span>
    );
  }

  if (normalizedTier === 'CLAIMED') {
    return (
      <span className="inline-flex items-center gap-0.5 text-blue-500 text-xs font-medium">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Verified
      </span>
    );
  }

  return null;
}

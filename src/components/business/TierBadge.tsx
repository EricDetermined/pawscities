'use client';

interface TierBadgeProps {
  tier: 'free' | 'premium';
}

export function TierBadge({ tier }: TierBadgeProps) {
  if (tier === 'premium') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium">
        <span>👑</span>
        Premium
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
      Free
    </span>
  );
}

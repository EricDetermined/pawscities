'use client';

import Link from 'next/link';

export function UpgradePrompt() {
  return (
    <div className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 rounded-lg p-6 text-white mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Upgrade to Premium</h3>
          <ul className="text-sm space-y-1 mb-4">
            <li className="flex items-center gap-2">
              <span>✓</span> Respond to customer reviews
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> View detailed analytics
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Upload up to 10 photos
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Premium search placement
            </li>
          </ul>
          <p className="text-sm font-medium">Starting at just $29/month</p>
        </div>
        <Link
          href="/business/upgrade"
          className="px-6 py-2 bg-white text-orange-600 rounded-lg hover:bg-gray-50 transition-colors font-bold whitespace-nowrap flex-shrink-0"
        >
          Learn More
        </Link>
      </div>
    </div>
  );
}

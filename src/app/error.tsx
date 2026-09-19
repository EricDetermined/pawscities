'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportBoundaryError } from '@/components/ErrorReporter';

// Route-level error boundary (2026-09-20). Catches render crashes in any page,
// reports them to /api/client-error, and shows a branded recovery screen
// instead of a white page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportBoundaryError(error); }, [error]);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🐾</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong on our end</h1>
      <p className="text-gray-600 mb-6 max-w-md">
        Sorry about that — our team has been notified automatically. Try again, or head back home.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
          Try again
        </button>
        <Link href="/" className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          Back to Paw Cities
        </Link>
      </div>
    </div>
  );
}

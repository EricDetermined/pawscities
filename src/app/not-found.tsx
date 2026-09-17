import Link from 'next/link';

// Branded 404 (2026-09-17 signed-out journey audit: default Next 404 was a
// bare dead-end with no navigation back into the site).
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🐾</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">This trail went cold</h1>
      <p className="text-gray-600 mb-6 max-w-md">
        We sniffed everywhere, but this page doesn&apos;t exist — it may have moved
        or the link had a typo.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
          Back to Paw Cities
        </Link>
        <Link href="/#cities" className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          Browse cities
        </Link>
      </div>
    </div>
  );
}

import { NextRequest } from 'next/server';

/**
 * Verify cron request authorization.
 *
 * Supports three methods (in priority order):
 * 1. Vercel's Authorization header: `Authorization: Bearer <CRON_SECRET>`
 *    (Vercel sends this automatically for cron jobs)
 * 2. Query parameter: `?secret=<CRON_SECRET>`
 *    (For manual triggering via browser/curl)
 * 3. Vercel cron user-agent check (fallback)
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON AUTH] CRON_SECRET not set');
    return false;
  }

  // Method 1: Vercel sends Authorization: Bearer <CRON_SECRET> for cron jobs
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === cronSecret) return true;
  }

  // Method 2: Query parameter ?secret=<value>
  const querySecret = request.nextUrl.searchParams.get('secret');
  if (querySecret && querySecret === cronSecret) return true;

  // Not authorized
  return false;
}

/**
 * Canonical base URL for server-side self-fetches from cron routes and jobs.
 *
 * WHY (2026-09-22): base URLs had drifted across crons — some read
 * NEXT_PUBLIC_SITE_URL, some NEXT_PUBLIC_BASE_URL, and three fell back to
 * http://localhost:3000. If only one of the two env var names was set on
 * Vercel, the crons reading the other name silently fetched localhost and
 * failed. This helper checks both names, then the Vercel deployment URL, and
 * finally the production origin — NEVER localhost in production — so a missing
 * or renamed var can't wedge a cron's internal fetch.
 *
 * All cron routes should import and use this instead of reading the env vars
 * directly.
 */
export function getSiteBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (fromEnv) return fromEnv;

  // Only fall back to localhost outside production (local dev). In any deployed
  // environment, prefer the canonical origin so self-fetches never hit localhost.
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  return 'https://pawcities.com';
}

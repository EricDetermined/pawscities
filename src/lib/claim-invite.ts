import crypto from 'crypto';

// Shared helpers for the one-click, email-verified claim flow (2026-09-24).

export const CLAIM_TOKEN_TTL_DAYS = 30;

/** URL-safe single-use claim token. */
export function newClaimToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** Categories that can never be claimed (community-maintained public spaces). */
export const NON_CLAIMABLE = ['parks', 'beaches'];

/** Tamper-proof signature for one-click unsubscribe links (no login needed). */
export function unsubSignature(establishmentId: string): string {
  return crypto
    .createHmac('sha256', process.env.CRON_SECRET || 'dev-secret')
    .update(establishmentId)
    .digest('hex')
    .slice(0, 16);
}

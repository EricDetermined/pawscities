/**
 * Cross-surface Instagram activity lock (2026-09-22).
 *
 * WHY: @thepawcities is driven by two independent surfaces — the browser
 * engagement/discovery sessions (local scheduled tasks) and the Graph-API crons
 * (social-post, social-engagement). They previously had no shared coordination,
 * so a Graph-API post could fire while a browser comment session was live.
 * Concurrent multi-surface automation on one account is exactly what triggered
 * the August 2026 suspension.
 *
 * This is an ADVISORY lock stored in Supabase `app_config` (key
 * `ig_session_active`, value = ISO timestamp of the active browser session).
 * The browser tasks set it on start and clear it on end via /api/admin/ig-lock.
 * The Graph-API crons check it and defer their run if a browser session is
 * active. A staleness guard (LOCK_TTL_MINUTES) means a crashed browser session
 * can never permanently wedge posting — the lock is ignored once stale, and the
 * posting crons have multiple slots + a never-zero guarantee, so a deferral just
 * moves a post to its next slot.
 */

import { createClient } from '@supabase/supabase-js';

export const IG_LOCK_KEY = 'ig_session_active';
export const LOCK_TTL_MINUTES = 75; // browser sessions run ~30-60 min; margin beyond that

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface IgLockState {
  active: boolean;
  since: string | null; // ISO timestamp the lock was acquired, if fresh
  stale: boolean;       // a value existed but is older than the TTL
}

/**
 * Read the current lock state. Never throws — on any error it reports the lock
 * as inactive so a transient DB blip can't block posting.
 */
export async function getIgLockState(): Promise<IgLockState> {
  try {
    const { data, error } = await admin()
      .from('app_config').select('value').eq('key', IG_LOCK_KEY).maybeSingle();
    if (error || !data?.value) return { active: false, since: null, stale: false };

    const ts = Date.parse(String(data.value));
    if (Number.isNaN(ts)) return { active: false, since: null, stale: false };

    const ageMin = (Date.now() - ts) / 60000;
    if (ageMin > LOCK_TTL_MINUTES) return { active: false, since: null, stale: true };
    return { active: true, since: new Date(ts).toISOString(), stale: false };
  } catch {
    return { active: false, since: null, stale: false };
  }
}

/** Convenience: true only when a browser IG session is currently (freshly) active. */
export async function isBrowserIgSessionActive(): Promise<boolean> {
  return (await getIgLockState()).active;
}

/** Acquire the lock (browser session start). Stamps now(). owner is accepted
 *  for call-site clarity but not persisted (app_config is a simple key/value). */
export async function acquireIgLock(_owner?: string): Promise<void> {
  await admin().from('app_config').upsert({
    key: IG_LOCK_KEY,
    value: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

/** Release the lock (browser session end). Clears the value. */
export async function releaseIgLock(): Promise<void> {
  await admin().from('app_config').upsert({
    key: IG_LOCK_KEY,
    value: '',
    updated_at: new Date().toISOString(),
  });
}

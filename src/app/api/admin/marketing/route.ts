export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getIgLockState } from '@/lib/ig-lock';

/**
 * Marketing command center data (2026-09-24).
 *
 * One endpoint that gives Eric full visibility across the growth machine:
 *   - Agent health   : heartbeats + IG advisory lock state
 *   - Claims funnel  : listings → contactable unclaimed → claimed
 *   - Email outreach : enrichment coverage + progress cursor
 *   - DM outreach    : follower-business pipeline + total DMs sent
 *   - Localization   : per-language translation coverage for listings & events
 *
 * All queries are individually fault-tolerant so one missing table never blanks
 * the whole page.
 */

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const LOCALES: Array<{ code: string; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
  { code: 'ja', label: '日本語' },
];

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = admin();
  if (!sb) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 500 });

  const cnt = async (label: string, build: () => any): Promise<number> => {
    try {
      const { count, error } = await build();
      if (error) { console.error(`[marketing] ${label}`, error.message); return 0; }
      return count || 0;
    } catch (e: any) { console.error(`[marketing] ${label}`, e?.message); return 0; }
  };

  // ── Claims funnel ────────────────────────────────────────────────
  const [activeListings, claimedListings, unclaimedContactable, pendingListings] = await Promise.all([
    cnt('activeListings', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE')),
    cnt('claimedListings', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').not('claimed_by', 'is', null)),
    cnt('unclaimedContactable', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').is('claimed_by', null).or('instagram_handle.not.is.null,email.not.is.null')),
    cnt('pendingListings', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'PENDING_REVIEW')),
  ]);

  // ── Email enrichment ─────────────────────────────────────────────
  const [emailsGathered, missingEmail] = await Promise.all([
    cnt('emailsGathered', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').not('email', 'is', null)),
    cnt('missingEmail', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').is('email', null).not('website', 'is', null)),
  ]);

  // ── DM outreach funnel ───────────────────────────────────────────
  const [dmsSent, followerBusinesses, followerUnclaimed] = await Promise.all([
    cnt('dmsSent', () => sb.from('dm_invitations').select('*', { count: 'exact', head: true })),
    cnt('followerBusinesses', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('source', 'ig-follower')),
    cnt('followerUnclaimed', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('source', 'ig-follower').eq('status', 'ACTIVE').is('claimed_by', null).not('instagram_handle', 'is', null)),
  ]);

  // ── Localization coverage ────────────────────────────────────────
  const estWithDesc = await cnt('estWithDesc', () => sb.from('establishments').select('*', { count: 'exact', head: true }).not('description', 'is', null));
  const evtWithDesc = await cnt('evtWithDesc', () => sb.from('events').select('*', { count: 'exact', head: true }).not('description', 'is', null));

  const translation = await Promise.all(LOCALES.map(async (loc) => {
    const [est, evt] = await Promise.all([
      cnt(`est_${loc.code}`, () => sb.from('establishments').select('*', { count: 'exact', head: true }).not('description', 'is', null).not(`description_${loc.code}`, 'is', null)),
      cnt(`evt_${loc.code}`, () => sb.from('events').select('*', { count: 'exact', head: true }).not('description', 'is', null).not(`description_${loc.code}`, 'is', null)),
    ]);
    return { code: loc.code, label: loc.label, establishments: est, events: evt };
  }));

  // ── Agent health: heartbeats + cursors + IG lock ─────────────────
  let heartbeats: Array<{ agent: string; status: string; detail: string; at: string | null }> = [];
  const cursors: Record<string, string> = {};
  try {
    const { data } = await sb.from('app_config').select('key,value,updated_at')
      .or('key.like.heartbeat:%,key.eq.email_enrich_cursor,key.eq.translate_content_cursor');
    for (const row of data || []) {
      const k = String(row.key);
      if (k.startsWith('heartbeat:')) {
        let p: any = {};
        try { p = JSON.parse(String(row.value || '{}')); } catch { /* ignore */ }
        heartbeats.push({ agent: k.slice('heartbeat:'.length), status: p.status || 'unknown', detail: p.detail || '', at: p.at || row.updated_at || null });
      } else {
        cursors[k] = String(row.value || '');
      }
    }
    heartbeats.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  } catch (e: any) { console.error('[marketing] app_config', e?.message); }

  const igLock = await getIgLockState().catch(() => ({ active: false, since: null, stale: false }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    claims: {
      activeListings,
      claimedListings,
      unclaimedContactable,
      pendingListings,
      claimRate: activeListings ? Math.round((claimedListings / activeListings) * 100) : 0,
    },
    email: {
      gathered: emailsGathered,
      missing: missingEmail,
      coverage: (emailsGathered + missingEmail) ? Math.round((emailsGathered / (emailsGathered + missingEmail)) * 100) : 0,
      cursorDone: cursors['email_enrich_cursor'] === '',
    },
    dms: {
      sent: dmsSent,
      followerBusinesses,
      followerUnclaimed,
    },
    localization: {
      establishmentsWithDescription: estWithDesc,
      eventsWithDescription: evtWithDesc,
      byLocale: translation.map((t) => ({
        ...t,
        estPct: estWithDesc ? Math.round((t.establishments / estWithDesc) * 100) : 0,
        evtPct: evtWithDesc ? Math.round((t.events / evtWithDesc) * 100) : 0,
      })),
    },
    agents: {
      heartbeats,
      igLock,
    },
  });
}

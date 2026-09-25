import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Outreach funnel accounting (2026-09-25).
 *
 * ONE source of truth for "is the growth machine actually working", shared by
 * the admin command center, the daily marketing digest email, and the
 * /api/admin/outreach-funnel endpoint that the agents curl. They must never
 * disagree, so nobody recomputes these numbers locally.
 *
 * It answers three questions per channel:
 *   1. Volume    — how many businesses did we reach, and did they answer?
 *   2. Delivery  — did a claim link actually go out, and was it clicked?
 *   3. Stalls    — where is something sitting that a human or agent dropped?
 *
 * Every query is fault-tolerant: a missing table degrades one number to 0
 * rather than blanking the report.
 *
 * SOURCE TAGGING: claim_tokens.source and business_claims.source are written by
 * the claim flow as 'email-invite' (link emailed to the business's own address)
 * or 'dm-invite' (link sent in an Instagram DM). Older rows use 'dm' or are
 * null. normalizeSource() collapses all of that, because counting the raw
 * string is how DM conversions silently read zero for a week.
 */

export type OutreachChannel = 'email' | 'dm' | 'ambassador' | 'organic' | 'other';

export interface AttentionItem {
  kind: string;
  severity: 'critical' | 'warn' | 'info';
  label: string;
  detail: string;
  count: number;
  /** Handles / names to act on, capped so a report never turns into a dump. */
  examples: string[];
}

export interface OutreachFunnel {
  generatedAt: string;
  inventory: {
    activeListings: number;
    unclaimed: number;
    /** Unclaimed, live, has an email, not opted out, never invited → the email cron can send today. */
    readyToEmail: number;
    /** Unclaimed, live, has an IG handle, never DMed → the DM agent can send today. */
    readyToDm: number;
    /** Unclaimed with a website but no email yet → what enrichment still owes us. */
    missingEmail: number;
    optedOut: number;
  };
  dm: {
    sent: number;
    replied: number;
    replyRate: number;
    linksDelivered: number;
    clicked: number;
    clickRate: number;
    claimed: number;
    sent7d: number;
    replied7d: number;
  };
  email: {
    invitesSent: number;
    clicked: number;
    clickRate: number;
    claimed: number;
    sent7d: number;
    clicked7d: number;
  };
  claims: {
    total: number;
    bySource: Record<OutreachChannel, number>;
    last7d: number;
    last30d: number;
  };
  tokens: {
    outstanding: number;
    expiringSoon: number;
    expiredUnused: number;
  };
  attention: AttentionItem[];
}

/** Agents that must check in daily for the outreach machine to be considered healthy. */
export const EXPECTED_OUTREACH_AGENTS: Array<{ agent: string; maxAgeHours: number; what: string }> = [
  { agent: 'business-claim-dms', maxAgeHours: 36, what: 'sends the daily claim DMs' },
  { agent: 'business-dm-reply-sweep', maxAgeHours: 36, what: 'answers replies and delivers claim links' },
];

const DAY = 86400_000;
const MAX_EXAMPLES = 8;
/**
 * A reply older than this is history, not a to-do. Without the bound, threads
 * that were answered by hand months ago (before the reply sweep existed, and
 * before claim links were a thing) sit in the report as permanent red items and
 * train everyone to ignore it.
 */
const REPLY_ACTIONABLE_DAYS = 14;

export function normalizeSource(raw: string | null | undefined): OutreachChannel {
  const s = (raw || '').toLowerCase().trim();
  if (s === 'email-invite' || s === 'email' || s === 'email_token') return 'email';
  if (s === 'dm-invite' || s === 'dm' || s === 'instagram_dm' || s === 'instagram-dm') return 'dm';
  if (s === 'ambassador') return 'ambassador';
  if (s === 'organic') return 'organic';
  return 'other';
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function ageHours(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 3600_000;
}

interface TokenRow { establishment_id: string; source: string | null; created_at: string | null; used_at: string | null; expires_at: string | null }
interface DmRow { handle: string; venue_name: string | null; city: string | null; sent_at: string | null; replied: boolean | null; replied_at: string | null; claimed_listing: boolean | null }
interface ClaimRow { source: string | null; status: string | null; created_at: string | null }

/**
 * Compute the whole funnel. `heartbeats` is optional; pass the app_config
 * heartbeat rows and stale agents become attention items too.
 */
export async function computeOutreachFunnel(
  sb: SupabaseClient,
  heartbeats?: Array<{ agent: string; status: string; at: string | null }>,
): Promise<OutreachFunnel> {
  const now = Date.now();

  const cnt = async (label: string, build: () => any): Promise<number> => {
    try {
      const { count, error } = await build();
      if (error) { console.error(`[funnel] ${label}`, error.message); return 0; }
      return count || 0;
    } catch (e: any) { console.error(`[funnel] ${label}`, e?.message); return 0; }
  };

  const rows = async <T>(label: string, build: () => any): Promise<T[]> => {
    try {
      const { data, error } = await build();
      if (error) { console.error(`[funnel] ${label}`, error.message); return []; }
      return (data || []) as T[];
    } catch (e: any) { console.error(`[funnel] ${label}`, e?.message); return []; }
  };

  const [
    activeListings, unclaimed, readyToEmail, readyToDm, missingEmail, optedOut,
    tokenRows, dmRows, claimRows,
  ] = await Promise.all([
    cnt('activeListings', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE')),
    cnt('unclaimed', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').is('claimed_by', null)),
    cnt('readyToEmail', () => sb.from('establishments').select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE').is('claimed_by', null).not('email', 'is', null)
      .eq('claim_invite_optout', false).is('claim_invite_sent_at', null)),
    cnt('readyToDm', () => sb.from('establishments').select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE').is('claimed_by', null).not('instagram_handle', 'is', null)),
    cnt('missingEmail', () => sb.from('establishments').select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE').is('claimed_by', null).is('email', null).not('website', 'is', null)),
    cnt('optedOut', () => sb.from('establishments').select('*', { count: 'exact', head: true }).eq('claim_invite_optout', true)),
    rows<TokenRow>('claim_tokens', () => sb.from('claim_tokens').select('establishment_id,source,created_at,used_at,expires_at').limit(5000)),
    rows<DmRow>('dm_invitations', () => sb.from('dm_invitations').select('handle,venue_name,city,sent_at,replied,replied_at,claimed_listing').limit(5000)),
    rows<ClaimRow>('business_claims', () => sb.from('business_claims').select('source,status,created_at').limit(5000)),
  ]);

  // ── Tokens, split by the channel that delivered them ──────────────────────
  const dmTokens = tokenRows.filter((t) => normalizeSource(t.source) === 'dm');
  const emailTokens = tokenRows.filter((t) => normalizeSource(t.source) === 'email');
  const used = (t: TokenRow) => !!t.used_at;
  const within = (iso: string | null | undefined, days: number) =>
    !!iso && !Number.isNaN(Date.parse(iso)) && now - Date.parse(iso) <= days * DAY;

  // ── DM channel ────────────────────────────────────────────────────────────
  const dmSent = dmRows.length;
  const dmReplied = dmRows.filter((d) => d.replied).length;
  const dmClaimed = dmRows.filter((d) => d.claimed_listing).length;
  const dmLinks = dmTokens.length;
  const dmClicked = dmTokens.filter(used).length;

  // ── Email channel ─────────────────────────────────────────────────────────
  const emailSent = emailTokens.length;
  const emailClicked = emailTokens.filter(used).length;

  // ── Claims by source ──────────────────────────────────────────────────────
  const approved = claimRows.filter((c) => (c.status || '').toUpperCase() === 'APPROVED');
  const bySource: Record<OutreachChannel, number> = { email: 0, dm: 0, ambassador: 0, organic: 0, other: 0 };
  for (const c of approved) bySource[normalizeSource(c.source)] += 1;

  // ── Stalls: things a human or an agent dropped ────────────────────────────
  const attention: AttentionItem[] = [];
  const tokenByEst = new Set(dmTokens.map((t) => t.establishment_id));

  // A business said yes and nobody sent them a link. This is the failure that
  // wastes a real lead, so it outranks everything else in the report.
  const repliedHandles = dmRows.filter((d) => d.replied && !d.claimed_listing);
  if (repliedHandles.length) {
    const handleToEst = new Map<string, string>();
    const estRows = await rows<{ id: string; instagram_handle: string | null }>('estByHandle', () =>
      sb.from('establishments').select('id,instagram_handle')
        .in('instagram_handle', repliedHandles.map((d) => d.handle).slice(0, 200)));
    for (const e of estRows) if (e.instagram_handle) handleToEst.set(e.instagram_handle.replace(/^@/, '').toLowerCase(), e.id);

    const awaiting = repliedHandles.filter((d) => {
      const est = handleToEst.get((d.handle || '').toLowerCase());
      if (est && tokenByEst.has(est)) return false; // link already delivered
      const h = ageHours(d.replied_at);
      // Old enough that someone should have acted, recent enough to still act on.
      return h >= 24 && h <= REPLY_ACTIONABLE_DAYS * 24;
    });
    if (awaiting.length) {
      const stale48 = awaiting.filter((d) => ageHours(d.replied_at) >= 48).length;
      attention.push({
        kind: 'reply_awaiting_link',
        severity: stale48 > 0 ? 'critical' : 'warn',
        label: 'Replies with no claim link sent',
        detail: 'These businesses answered our DM and never received a claim link. The reply sweep should have handled them.',
        count: awaiting.length,
        examples: awaiting.slice(0, MAX_EXAMPLES).map((d) => `@${d.handle}${d.venue_name ? ` (${d.venue_name})` : ''}`),
      });
    }
  }

  // Links delivered that nobody clicked. Not a failure, but it is the number
  // that tells us whether the copy or the channel is working.
  const notExpired = (t: TokenRow) => {
    const exp = t.expires_at ? Date.parse(t.expires_at) : NaN;
    return !Number.isNaN(exp) && exp > now;
  };
  const outstanding = tokenRows.filter((t) => !used(t) && notExpired(t));
  const stale7 = outstanding.filter((t) => ageHours(t.created_at) >= 7 * 24);
  if (stale7.length) {
    attention.push({
      kind: 'token_unclicked',
      severity: 'info',
      label: 'Claim links sent but never opened',
      detail: 'Outstanding more than 7 days. Worth a nudge or a copy rethink if this keeps growing.',
      count: stale7.length,
      examples: [],
    });
  }

  const expiringSoon = outstanding.filter((t) => {
    const exp = t.expires_at ? Date.parse(t.expires_at) : NaN;
    return !Number.isNaN(exp) && exp - now <= 7 * DAY;
  });
  if (expiringSoon.length) {
    attention.push({
      kind: 'token_expiring',
      severity: 'warn',
      label: 'Claim links expiring within 7 days',
      detail: 'Unused tokens about to lapse. Re-mint if the business is still worth chasing.',
      count: expiringSoon.length,
      examples: [],
    });
  }

  // Inventory starvation: the agents will quietly send nothing.
  if (readyToDm < 10) {
    attention.push({
      kind: 'dm_inventory_low',
      severity: readyToDm === 0 ? 'warn' : 'info',
      label: 'DM targets running low',
      detail: `${readyToDm} unclaimed listings with an Instagram handle remain. At 5 DMs a day this is under two days of sends.`,
      count: readyToDm,
      examples: [],
    });
  }
  if (readyToEmail === 0 && missingEmail > 0) {
    attention.push({
      kind: 'email_inventory_empty',
      severity: 'warn',
      label: 'Email invite queue is empty',
      detail: `Nothing left to email, while ${missingEmail} unclaimed listings have a website but no contact email. Enrichment is the bottleneck.`,
      count: missingEmail,
      examples: [],
    });
  }

  // Attribution holes: claims we cannot credit to a channel.
  const untagged = bySource.other;
  if (untagged > 0) {
    attention.push({
      kind: 'claims_untagged',
      severity: 'info',
      label: 'Approved claims with no channel tag',
      detail: 'Pre-attribution rows, or a claim path that is not setting source. Everything new should be tagged.',
      count: untagged,
      examples: [],
    });
  }

  // Agents that stopped reporting. Silent agents look identical to healthy ones.
  if (heartbeats) {
    const byAgent = new Map(heartbeats.map((h) => [h.agent, h]));
    const dead = EXPECTED_OUTREACH_AGENTS.filter(({ agent, maxAgeHours }) => {
      const hb = byAgent.get(agent);
      return !hb || hb.status !== 'ok' || ageHours(hb.at) > maxAgeHours;
    });
    if (dead.length) {
      attention.push({
        kind: 'agent_stale',
        severity: 'critical',
        label: 'Outreach agent has not checked in',
        detail: 'No healthy heartbeat within its expected window, so outreach may have silently stopped.',
        count: dead.length,
        examples: dead.map((d) => `${d.agent} (${d.what})`),
      });
    }
  }

  const order = { critical: 0, warn: 1, info: 2 } as const;
  attention.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    inventory: { activeListings, unclaimed, readyToEmail, readyToDm, missingEmail, optedOut },
    dm: {
      sent: dmSent,
      replied: dmReplied,
      replyRate: pct(dmReplied, dmSent),
      linksDelivered: dmLinks,
      clicked: dmClicked,
      clickRate: pct(dmClicked, dmLinks),
      claimed: dmClaimed,
      sent7d: dmRows.filter((d) => within(d.sent_at, 7)).length,
      replied7d: dmRows.filter((d) => d.replied && within(d.replied_at, 7)).length,
    },
    email: {
      invitesSent: emailSent,
      clicked: emailClicked,
      clickRate: pct(emailClicked, emailSent),
      claimed: bySource.email,
      sent7d: emailTokens.filter((t) => within(t.created_at, 7)).length,
      clicked7d: emailTokens.filter((t) => within(t.used_at, 7)).length,
    },
    claims: {
      total: approved.length,
      bySource,
      last7d: approved.filter((c) => within(c.created_at, 7)).length,
      last30d: approved.filter((c) => within(c.created_at, 30)).length,
    },
    tokens: {
      outstanding: outstanding.length,
      expiringSoon: expiringSoon.length,
      expiredUnused: tokenRows.filter((t) => !used(t) && !notExpired(t)).length,
    },
    attention,
  };
}

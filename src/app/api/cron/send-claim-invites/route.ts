import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSiteBaseUrl } from '@/lib/base-url';
import { sendClaimInvite } from '@/lib/email';
import { newClaimToken, unsubSignature, NON_CLAIMABLE, CLAIM_TOKEN_TTL_DAYS } from '@/lib/claim-invite';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Claim-invitation sender (2026-09-24).
 *
 * The missing scalable outreach channel: for each live, unclaimed listing that
 * has a contact email (gathered by enrich-contact-emails), generate a single-use
 * token and email a one-click claim link to the business's own address. Clicking
 * it auto-approves the claim (email control = ownership proof).
 *
 * Paced to protect domain reputation: BATCH per run, self-advancing (we stamp
 * claim_invite_sent_at, so each row is emailed once and drops out next run).
 * Skips opt-outs, non-claimable categories, and listings with a live claim.
 */

const BATCH = Number(process.env.CLAIM_INVITE_BATCH || 30);

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'resend_not_configured' }, { status: 500 });

  const sb = admin();
  const base = getSiteBaseUrl();

  // Non-claimable category ids (parks/beaches).
  const { data: badCats } = await sb.from('categories').select('id').in('slug', NON_CLAIMABLE);
  const badCatIds = (badCats || []).map((c: { id: string }) => c.id);

  // Candidates: live, unclaimed, has email, not opted out, not yet invited.
  let q = sb.from('establishments')
    .select('id, name, email, city_id, category_id')
    .eq('status', 'ACTIVE')
    .is('claimed_by', null)
    .not('email', 'is', null)
    .eq('claim_invite_optout', false)
    .is('claim_invite_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (badCatIds.length) q = q.not('category_id', 'in', `(${badCatIds.join(',')})`);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ status: 'no_candidates', sent: 0 });

  // Exclude any with an existing live (pending/approved) claim.
  const ids = rows.map(r => r.id);
  const { data: liveClaims } = await sb.from('business_claims')
    .select('establishment_id').in('establishment_id', ids).in('status', ['PENDING', 'APPROVED']);
  const claimed = new Set((liveClaims || []).map((c: { establishment_id: string }) => c.establishment_id));

  // City names for the batch.
  const cityIds = [...new Set(rows.map(r => r.city_id).filter(Boolean))];
  const cityName = new Map<string, string>();
  if (cityIds.length) {
    const { data: cities } = await sb.from('cities').select('id, name').in('id', cityIds);
    for (const c of cities || []) cityName.set(c.id, c.name);
  }

  const expiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_DAYS * 86400 * 1000).toISOString();
  let sent = 0, skipped = 0, failed = 0;
  const results: Array<{ id: string; email: string; ok: boolean }> = [];

  for (const est of rows) {
    if (claimed.has(est.id)) { skipped++; continue; }
    const email = String(est.email).trim().toLowerCase();
    if (!email || !email.includes('@')) { skipped++; continue; }

    const token = newClaimToken();
    const { error: tErr } = await sb.from('claim_tokens').insert({
      token, establishment_id: est.id, email, business_name: est.name,
      source: 'email-invite', expires_at: expiresAt,
    });
    if (tErr) { failed++; continue; }

    const claimUrl = `${base}/business/claim/${token}`;
    const unsubUrl = `${base}/api/claim-invite/unsubscribe?e=${est.id}&s=${unsubSignature(est.id)}`;
    const res = await sendClaimInvite(email, est.name, cityName.get(est.city_id) || '', claimUrl, unsubUrl);

    if (res.success) {
      await sb.from('establishments').update({
        claim_invite_sent_at: new Date().toISOString(),
        claim_invite_count: 1,
      }).eq('id', est.id);
      sent++; results.push({ id: est.id, email, ok: true });
    } else {
      failed++; results.push({ id: est.id, email, ok: false });
    }
  }

  return NextResponse.json({ status: 'ok', candidates: rows.length, sent, skipped, failed, results });
}

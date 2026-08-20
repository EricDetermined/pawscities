export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getMetaApiVersion } from '@/lib/instagram';

/**
 * GET /api/cron/account-snapshot
 *
 * Records one row per day of follower / following / post counts.
 *
 * Why this exists: as of the 2026-08-19 audit there was no follower time series
 * at all, so "are we growing?" was unanswerable. Reach and impressions are
 * blocked behind a Meta permission the app doesn't hold
 * (instagram_manage_insights → OAuthException #10), but the plain account
 * fields below work under instagram_basic, so this is measurable today rather
 * than after App Review.
 *
 * Deltas are computed at write time against the previous snapshot so the table
 * can be charted directly without window functions.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const igId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!token || !igId) {
    return NextResponse.json(
      { error: 'META_PAGE_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID not configured' },
      { status: 500 },
    );
  }

  const v = getMetaApiVersion();
  const url =
    `https://graph.facebook.com/${v}/${igId}` +
    `?fields=username,followers_count,follows_count,media_count&access_token=${token}`;

  let account: Record<string, unknown>;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    account = await res.json();
  } catch (err) {
    console.error('[ACCOUNT-SNAPSHOT] Graph API request failed:', err);
    return NextResponse.json({ error: 'graph_request_failed', detail: String(err) }, { status: 502 });
  }

  // Never let an API error masquerade as a real zero — that is exactly how four
  // months of reach data ended up looking like measured zeros.
  if (account.error) {
    console.error('[ACCOUNT-SNAPSHOT] Graph API error:', JSON.stringify(account.error));
    return NextResponse.json({ error: 'graph_api_error', detail: account.error }, { status: 502 });
  }

  const followers = Number(account.followers_count ?? NaN);
  const follows = Number(account.follows_count ?? NaN);
  const media = Number(account.media_count ?? NaN);
  if (!Number.isFinite(followers)) {
    return NextResponse.json({ error: 'no_follower_count_in_response', detail: account }, { status: 502 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const today = new Date().toISOString().slice(0, 10);

  // Previous snapshot for deltas
  const { data: prev } = await supabase
    .from('account_snapshots')
    .select('followers_count, follows_count, media_count, captured_on')
    .lt('captured_on', today)
    .order('captured_on', { ascending: false })
    .limit(1);

  const p = prev?.[0];
  const row = {
    captured_on: today,
    platform: 'instagram',
    username: String(account.username ?? ''),
    followers_count: followers,
    follows_count: Number.isFinite(follows) ? follows : null,
    media_count: Number.isFinite(media) ? media : null,
    followers_delta: p ? followers - (p.followers_count ?? 0) : null,
    follows_delta: p && Number.isFinite(follows) ? follows - (p.follows_count ?? 0) : null,
    media_delta: p && Number.isFinite(media) ? media - (p.media_count ?? 0) : null,
    source: 'graph_api',
  };

  const { error } = await supabase
    .from('account_snapshots')
    .upsert(row, { onConflict: 'captured_on,platform' });

  if (error) {
    // Table may not exist yet (migration 021 is applied by hand). Say so plainly
    // rather than returning a misleading success.
    console.error('[ACCOUNT-SNAPSHOT] write failed:', error.message);
    return NextResponse.json(
      {
        error: 'snapshot_write_failed',
        detail: error.message,
        hint: 'Apply supabase/migrations/021_growth_measurement.sql',
        captured: row,
      },
      { status: 500 },
    );
  }

  console.log(
    `[ACCOUNT-SNAPSHOT] ${today} followers=${followers} (${row.followers_delta ?? 'n/a'}) ` +
      `following=${follows} posts=${media}`,
  );

  return NextResponse.json({ success: true, snapshot: row, previous: p ?? null });
}

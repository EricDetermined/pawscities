import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import {
  classifyEventRelevance,
  extractMentionedHandles,
  isBusinessPost,
  hasGeoConflict,
  detectCity,
  scanPosterWithVision,
} from '@/lib/event-discovery-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/handle-discovery
 *
 * ALWAYS-ON server-side event discovery channel: watches the watch_handles
 * registry (venues, event organizers, community accounts) daily via the
 * Instagram Graph API "business discovery" endpoint. Free — no Apify, no
 * browser session.
 *
 * Each run:
 *   1. Picks the ~60 active handles with the oldest last_checked_at (nulls
 *      first) — unfinished handles carry to the next run automatically.
 *   2. Business-discovers each handle's recent media (6 most recent posts).
 *   3. Filters media newer than last_post_timestamp (or last 7 days on the
 *      first check) and prefilters for event-likeness with the same keyword/
 *      date heuristics as the hashtag channel.
 *   4. Runs surviving IMAGE posts through GPT-4o Vision poster extraction.
 *   5. Writes candidates into ingest_queue (source 'handle_discovery') so
 *      process-ingest applies the full quality gate + dedup before anything
 *      becomes a PENDING event.
 *
 * Personal (non-business) accounts are marked is_business=false and
 * deactivated — business discovery only works on business/creator accounts.
 * Transient failures increment consecutive_failures; 5 in a row deactivates.
 *
 * Auth: CRON_SECRET (Vercel Authorization header or ?secret= param).
 * Schedule: daily 07:30 UTC (before process-ingest at 09:00).
 */

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const HANDLES_PER_RUN = 60; // 40→60 (2026-09-11, Eric: increase discovery); 2x daily = ~120 handles/day
const MEDIA_PER_HANDLE = 6;
const MIN_EVENT_SCORE = 35;      // same quality bar as the hashtag channel
const VISION_SCAN_BUDGET = 20;   // per-run GPT-4o Vision cap (cost control; 15→20 with 60-handle batches)
const MAX_FAILURES = 5;          // deactivate after this many consecutive failures
const TIME_BUDGET_MS = 240_000;  // stop early, stay safely under maxDuration
const PER_HANDLE_DELAY_MS = 400; // Graph API rate-limit courtesy

interface WatchHandle {
  id: string;
  handle: string;
  city: string | null;
  handle_type: string | null;
  active: boolean;
  is_business: boolean | null;
  last_checked_at: string | null;
  last_post_timestamp: string | null;
  consecutive_failures: number;
  events_found: number;
}

interface BdMedia {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  media_type?: string;
  media_url?: string;
}

interface BdResponse {
  business_discovery?: {
    followers_count?: number;
    media_count?: number;
    media?: { data?: BdMedia[] };
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

// Error taxonomy for the business_discovery endpoint
function classifyGraphError(err: NonNullable<BdResponse['error']>): 'not_business' | 'no_permission' | 'rate_limit' | 'transient' {
  const msg = (err.message || '').toLowerCase();
  const code = err.code ?? 0;
  // Code 110 / "cannot be found": personal account, nonexistent, or blocked —
  // business discovery only resolves business/creator accounts.
  if (code === 110 || msg.includes('cannot be found') || msg.includes('does not exist')) return 'not_business';
  // Code 10 / 200 / 803 permission problems: token lacks business discovery scope
  if (code === 10 || code === 200 || msg.includes('permission') || msg.includes('oauth')) return 'no_permission';
  // Rate limiting
  if (code === 4 || code === 17 || code === 32 || code === 613 || msg.includes('rate limit') || msg.includes('request limit')) return 'rate_limit';
  return 'transient';
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
  const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
  const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';

  if (!META_PAGE_ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
    console.error('[HANDLE-DISCOVERY] META_PAGE_ACCESS_TOKEN / INSTAGRAM_ACCOUNT_ID not configured');
    return NextResponse.json(
      { error: 'Instagram Graph API not configured (need META_PAGE_ACCESS_TOKEN + INSTAGRAM_ACCOUNT_ID)' },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  // ── Select the active handles that have waited longest ────────────────────
  const { data: handles, error: fetchError } = await supabase
    .from('watch_handles')
    .select('id, handle, city, handle_type, active, is_business, last_checked_at, last_post_timestamp, consecutive_failures, events_found')
    .eq('active', true)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(HANDLES_PER_RUN);

  if (fetchError) {
    console.error('[HANDLE-DISCOVERY] watch_handles fetch failed:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!handles || handles.length === 0) {
    return NextResponse.json({ message: 'No active handles to check', handlesChecked: 0 });
  }

  const stats = {
    handlesChecked: 0,
    postsScanned: 0,
    candidates: 0,
    ingestRowsWritten: 0,
    skippedDupes: 0,
    deactivatedNonBusiness: 0,
    deactivatedFailures: 0,
    visionScansUsed: 0,
    failures: [] as string[],
  };
  let permissionError: string | null = null;
  let rateLimited = false;

  for (const wh of handles as WatchHandle[]) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.log('[HANDLE-DISCOVERY] Time budget reached — remaining handles carry to next run');
      break;
    }
    if (permissionError || rateLimited) break;

    const nowIso = new Date().toISOString();

    try {
      const fields = `business_discovery.username(${wh.handle}){followers_count,media_count,media.limit(${MEDIA_PER_HANDLE}){id,caption,permalink,timestamp,media_type,media_url}}`;
      const url = `https://graph.facebook.com/${META_API_VERSION}/${INSTAGRAM_ACCOUNT_ID}?fields=${encodeURIComponent(fields)}&access_token=${META_PAGE_ACCESS_TOKEN}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = (await res.json()) as BdResponse;

      if (data.error || !data.business_discovery) {
        const err = data.error || { message: 'empty business_discovery response' };
        const kind = data.error ? classifyGraphError(data.error) : 'transient';

        if (kind === 'not_business') {
          // Personal account — business discovery will never work; retire it
          await supabase.from('watch_handles').update({
            is_business: false,
            active: false,
            last_checked_at: nowIso,
          }).eq('id', wh.id);
          stats.deactivatedNonBusiness++;
          console.log(`[HANDLE-DISCOVERY] @${wh.handle}: not a business account — deactivated`);
        } else if (kind === 'no_permission') {
          // Token problem affects every handle — abort and surface it clearly
          permissionError = `Graph API permission error on @${wh.handle}: ${err.message}`;
          console.error(`[HANDLE-DISCOVERY] ${permissionError}`);
        } else if (kind === 'rate_limit') {
          rateLimited = true;
          console.warn(`[HANDLE-DISCOVERY] Rate limited at @${wh.handle} — stopping run, handles carry over`);
        } else {
          const failures = (wh.consecutive_failures || 0) + 1;
          await supabase.from('watch_handles').update({
            consecutive_failures: failures,
            active: failures < MAX_FAILURES,
            last_checked_at: nowIso,
          }).eq('id', wh.id);
          if (failures >= MAX_FAILURES) stats.deactivatedFailures++;
          stats.failures.push(`@${wh.handle}: ${err.message}`);
          console.warn(`[HANDLE-DISCOVERY] @${wh.handle} failed (${failures}/${MAX_FAILURES}): ${err.message}`);
        }
        continue;
      }

      stats.handlesChecked++;
      const media = data.business_discovery.media?.data || [];

      // ── Freshness window: newer than last_post_timestamp, or 7 days on first check ──
      const sinceMs = wh.last_post_timestamp
        ? new Date(wh.last_post_timestamp).getTime()
        : Date.now() - 7 * 24 * 60 * 60 * 1000;

      const freshMedia = media.filter(m => m.timestamp && new Date(m.timestamp).getTime() > sinceMs);
      stats.postsScanned += freshMedia.length;

      let newestPostMs = wh.last_post_timestamp ? new Date(wh.last_post_timestamp).getTime() : 0;
      for (const m of media) {
        if (m.timestamp) newestPostMs = Math.max(newestPostMs, new Date(m.timestamp).getTime());
      }

      let handleEventsFound = 0;

      for (const post of freshMedia) {
        // ── Event-likeness prefilter (same heuristics as hashtag channel) ──
        let score = classifyEventRelevance(post.caption || '', 0);
        if (score < MIN_EVENT_SCORE) continue;

        let city = detectCity(post.caption || '') || wh.city || null;
        if (city && hasGeoConflict(city, post.caption || '')) continue;

        const mentionedHandles = extractMentionedHandles(post.caption || '');
        const isBusiness = isBusinessPost(post.caption || '', wh.handle);

        let caption = (post.caption || '').substring(0, 800);
        let visionEnriched = false;

        // ── GPT-4o Vision poster extraction on image posts ──
        if (
          (post.media_type === 'IMAGE' || post.media_type === 'CAROUSEL_ALBUM') &&
          post.media_url &&
          stats.visionScansUsed < VISION_SCAN_BUDGET
        ) {
          const visionResult = await scanPosterWithVision(post.media_url);
          stats.visionScansUsed++;

          if (visionResult?.isEventPoster) {
            score = Math.min(score + 25, 100);
            visionEnriched = true;

            const enrichedParts: string[] = [];
            if (visionResult.eventName) enrichedParts.push(`Event: ${visionResult.eventName}`);
            if (visionResult.date) enrichedParts.push(`Date: ${visionResult.date}`);
            if (visionResult.time) enrichedParts.push(`Time: ${visionResult.time}`);
            if (visionResult.venue) enrichedParts.push(`Venue: ${visionResult.venue}`);
            if (visionResult.address) enrichedParts.push(`Address: ${visionResult.address}`);
            if (visionResult.organizer) enrichedParts.push(`Organizer: ${visionResult.organizer}`);
            if (visionResult.ticketUrl) enrichedParts.push(`Tickets: ${visionResult.ticketUrl}`);
            if (visionResult.description) enrichedParts.push(`Description: ${visionResult.description}`);
            enrichedParts.push('');
            enrichedParts.push(caption);
            caption = enrichedParts.join('\n');

            if (visionResult.address || visionResult.venue) {
              const visionCity = detectCity(`${visionResult.venue || ''} ${visionResult.address || ''}`);
              if (visionCity) city = visionCity;
            }
            if (visionResult.organizer && visionResult.organizer.startsWith('@')) {
              const h = visionResult.organizer.replace('@', '');
              if (!mentionedHandles.includes(h)) mentionedHandles.push(h);
            }
          }
        }

        stats.candidates++;

        const permalink = post.permalink || `https://www.instagram.com/${wh.handle}/`;

        // ── Dedup on permalink against ingest_queue + events ──
        const { data: existingIngest } = await supabase
          .from('ingest_queue').select('id').eq('url', permalink).limit(1);
        if (existingIngest && existingIngest.length > 0) { stats.skippedDupes++; continue; }
        const { data: existingEvent } = await supabase
          .from('events').select('id').eq('source_post_url', permalink).limit(1);
        if (existingEvent && existingEvent.length > 0) { stats.skippedDupes++; continue; }

        const visionTag = visionEnriched ? ' [POSTER-SCANNED]' : '';
        const bizTag = isBusiness ? ' [BUSINESS]' : '';
        const handleTag = mentionedHandles.length > 0
          ? ` | mentions: @${mentionedHandles.slice(0, 3).join(', @')}`
          : '';

        const { error: insertError } = await supabase.from('ingest_queue').insert({
          source: 'handle_discovery',
          submitted_by: 'cron:handle-discovery',
          url: permalink,
          raw_text: caption,
          subject: `Event candidate (score: ${score}) from @${wh.handle}${bizTag}${visionTag}${handleTag}`,
          platform: 'instagram',
          content_type: 'post',
          instagram_username: wh.handle,
          classification: isBusiness ? 'business_event' : 'event',
          city,
          priority: score >= 50 || isBusiness || visionEnriched ? 'high' : 'normal',
          status: 'pending',
        });

        if (insertError) {
          stats.failures.push(`@${wh.handle} insert: ${insertError.message}`);
          console.error(`[HANDLE-DISCOVERY] Insert failed for ${permalink}: ${insertError.message}`);
          continue;
        }
        stats.ingestRowsWritten++;
        handleEventsFound++;
      }

      // ── Bookkeeping ──
      await supabase.from('watch_handles').update({
        is_business: true,
        consecutive_failures: 0,
        last_checked_at: nowIso,
        last_post_timestamp: newestPostMs > 0 ? new Date(newestPostMs).toISOString() : wh.last_post_timestamp,
        events_found: (wh.events_found || 0) + handleEventsFound,
      }).eq('id', wh.id);

      if (freshMedia.length > 0) {
        console.log(`[HANDLE-DISCOVERY] @${wh.handle}: ${freshMedia.length} new posts, ${handleEventsFound} ingest rows`);
      }
    } catch (err) {
      // Network/timeout — count as transient failure
      const failures = (wh.consecutive_failures || 0) + 1;
      await supabase.from('watch_handles').update({
        consecutive_failures: failures,
        active: failures < MAX_FAILURES,
        last_checked_at: nowIso,
      }).eq('id', wh.id);
      if (failures >= MAX_FAILURES) stats.deactivatedFailures++;
      stats.failures.push(`@${wh.handle}: ${String(err).substring(0, 120)}`);
      console.error(`[HANDLE-DISCOVERY] Error checking @${wh.handle}:`, err);
    }

    await new Promise(r => setTimeout(r, PER_HANDLE_DELAY_MS));
  }

  const summary = [
    `Checked ${stats.handlesChecked}/${handles.length} handles`,
    `${stats.postsScanned} new posts scanned`,
    `${stats.candidates} event candidates`,
    `${stats.ingestRowsWritten} ingest rows written`,
    stats.skippedDupes > 0 ? `${stats.skippedDupes} dupes skipped` : '',
    stats.deactivatedNonBusiness > 0 ? `${stats.deactivatedNonBusiness} non-business deactivated` : '',
    stats.failures.length > 0 ? `${stats.failures.length} failures` : '',
  ].filter(Boolean).join('. ');
  console.log(`[HANDLE-DISCOVERY] ${summary}`);

  return NextResponse.json({
    success: !permissionError,
    handlesSelected: handles.length,
    handlesChecked: stats.handlesChecked,
    postsScanned: stats.postsScanned,
    candidates: stats.candidates,
    ingestRowsWritten: stats.ingestRowsWritten,
    skippedDupes: stats.skippedDupes,
    deactivatedNonBusiness: stats.deactivatedNonBusiness,
    deactivatedFailures: stats.deactivatedFailures,
    visionScansUsed: stats.visionScansUsed,
    rateLimited,
    permissionError,
    failures: stats.failures.slice(0, 20),
    elapsedMs: Date.now() - startedAt,
    summary,
  }, { status: permissionError ? 502 : 200 });
}

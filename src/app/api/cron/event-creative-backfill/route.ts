import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSiteBaseUrl } from '@/lib/base-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Event-creative backfill (2026-09-26) — never waste an event.
 *
 * Every upcoming event that still meets the 3-day lead should have a compliant,
 * dated event-card creative queued for review. Discovery auto-generates one at
 * creation, but events can be left uncovered (e.g. an old dateless-mascot
 * creative was rejected, or generation failed). This cron finds upcoming
 * approvable events with NO active creative and generates one — paced and
 * capped, soonest-event first — so the backlog self-heals and no opportunity is
 * dropped. generate_event always produces the dated card + tags all businesses.
 */

const BATCH = Number(process.env.EVENT_BACKFILL_BATCH || 12);
const MIN_LEAD_DAYS = 3;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = admin();
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const floor = new Date(today); floor.setUTCDate(floor.getUTCDate() + MIN_LEAD_DAYS);
  const floorStr = floor.toISOString().split('T')[0];

  // Upcoming, approvable events that still clear the 3-day lead, soonest first.
  const { data: events } = await sb.from('events')
    .select('id, name, start_date, status')
    .in('status', ['APPROVED', 'PENDING'])
    .gte('start_date', floorStr)
    .order('start_date', { ascending: true })
    .limit(200);
  if (!events || events.length === 0) return NextResponse.json({ status: 'no_events' });

  // Which already have an active creative (queued or live)?
  const ids = events.map(e => e.id);
  const covered = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data: cr } = await sb.from('creative_queue')
      .select('event_id')
      .in('status', ['pending_review', 'approved', 'generating', 'posted'])
      .in('event_id', chunk);
    for (const c of cr || []) if (c.event_id) covered.add(c.event_id as string);
  }

  const todo = events.filter(e => !covered.has(e.id)).slice(0, BATCH);
  if (todo.length === 0) return NextResponse.json({ status: 'all_covered', upcoming: events.length });

  const base = getSiteBaseUrl();
  const secret = process.env.CRON_SECRET;
  let ok = 0, failed = 0;
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  for (const e of todo) {
    try {
      const res = await fetch(`${base}/api/admin/creatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ action: 'generate_event', eventId: e.id }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success || data.creative || data.id)) { ok++; results.push({ name: e.name, ok: true }); }
      else { failed++; results.push({ name: e.name, ok: false, detail: data.error || `HTTP ${res.status}` }); }
    } catch (err: any) {
      failed++; results.push({ name: e.name, ok: false, detail: err?.message });
    }
  }

  const remaining = events.filter(e => !covered.has(e.id)).length - ok;
  return NextResponse.json({ status: 'ok', upcoming: events.length, generated: ok, failed, remaining, results });
}

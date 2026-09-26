import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { categorizeReason, NEVER_CATEGORIES, type LessonSeverity } from '@/lib/marketing-lessons';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Lesson loop (2026-09-26) — closed-loop learning for the social pipeline.
 *
 * Runs daily. Reads every rejection/failure the three protection layers logged
 * since the last run, categorizes each into a lesson with a recommended fix,
 * measures the feed's richness/timeliness/coverage, stores a dated snapshot
 * (app_config: lesson:<date> + lesson:latest) for trend, and escalates patterns:
 *   - Any "never" category appearing at all = a coded rule regressed → alert now.
 *   - Coverage dropping, or a "watch" category spiking = upstream problem → alert.
 * The daily fleet-watchdog also reads lesson:latest so the morning report shows
 * what was learned and whether the feed is improving.
 */

const NEVER = new Set(NEVER_CATEGORIES);

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}
const iso = (d: Date) => d.toISOString();
function addDays(base: Date, n: number) { const d = new Date(base); d.setUTCDate(d.getUTCDate() + n); return d; }

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = admin();
  const now = new Date();
  const today = iso(now).split('T')[0];
  const floorStr = iso(addDays(now, 3)).split('T')[0];
  const near4Str = iso(addDays(now, 4)).split('T')[0];

  // ── 1. New rejections/failures since last run (cursor) ─────────────────────
  const { data: cur } = await sb.from('app_config').select('value').eq('key', 'lesson:cursor').maybeSingle();
  const since = cur?.value || iso(addDays(now, -1));
  const { data: blocked } = await sb.from('creative_queue')
    .select('rejection_reason, error_message, content_type, updated_at')
    .in('status', ['rejected', 'failed'])
    .gt('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(1000);

  const byCategory: Record<string, { count: number; severity: LessonSeverity; fix: string; examples: string[] }> = {};
  let maxUpdated = since;
  for (const row of blocked || []) {
    const reason = row.rejection_reason || row.error_message || '';
    const lesson = categorizeReason(reason);
    const b = byCategory[lesson.category] || (byCategory[lesson.category] = { count: 0, severity: lesson.severity, fix: lesson.fix, examples: [] });
    b.count += 1;
    if (b.examples.length < 3 && reason) b.examples.push(reason.slice(0, 100));
    if (row.updated_at && row.updated_at > maxUpdated) maxUpdated = row.updated_at;
  }

  // ── 2. Feed health: coverage, timeliness risk, richness ────────────────────
  const cnt = async (q: () => any): Promise<number> => {
    try { const { count } = await q(); return count || 0; } catch { return 0; }
  };
  const upcomingTotal = await cnt(() => sb.from('events').select('*', { count: 'exact', head: true })
    .in('status', ['APPROVED', 'PENDING']).gte('start_date', floorStr));
  // Coverage: how many upcoming events have an active/compliant creative.
  const { data: upEvents } = await sb.from('events').select('id, mentioned_handles, venue_name')
    .in('status', ['APPROVED', 'PENDING']).gte('start_date', floorStr).limit(1000);
  const upIds = (upEvents || []).map(e => e.id);
  const covered = new Set<string>();
  for (let i = 0; i < upIds.length; i += 100) {
    const chunk = upIds.slice(i, i + 100);
    const { data: cr } = await sb.from('creative_queue').select('event_id')
      .in('status', ['pending_review', 'approved', 'posted']).in('event_id', chunk);
    for (const c of cr || []) if (c.event_id) covered.add(c.event_id as string);
  }
  const coveragePct = upcomingTotal ? Math.round((covered.size / upcomingTotal) * 100) : 100;
  const approvalRisk = await cnt(() => sb.from('events').select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING').gte('start_date', today).lte('start_date', near4Str));
  // Richness: business tagging depth + detail completeness on upcoming events.
  const withVenue = (upEvents || []).filter(e => (e.venue_name || '').trim().length > 2).length;
  const tagCounts = (upEvents || []).map(e => (e.mentioned_handles || []).length);
  const avgTags = tagCounts.length ? Math.round((tagCounts.reduce((a, b) => a + b, 0) / tagCounts.length) * 10) / 10 : 0;
  const taggedPct = tagCounts.length ? Math.round((tagCounts.filter(n => n > 0).length / tagCounts.length) * 100) : 0;
  const venuePct = upEvents && upEvents.length ? Math.round((withVenue / upEvents.length) * 100) : 100;

  // ── 3. Snapshot + trend vs previous ────────────────────────────────────────
  const { data: prevRow } = await sb.from('app_config').select('value').eq('key', 'lesson:latest').maybeSingle();
  let prev: any = null; try { prev = prevRow?.value ? JSON.parse(prevRow.value) : null; } catch { /* ignore */ }

  const snapshot = {
    date: today,
    generatedAt: iso(now),
    lessons: byCategory,
    feed: { upcomingEvents: upcomingTotal, coveragePct, approvalRisk, avgBusinessTags: avgTags, taggedPct, venuePct },
  };

  // ── 4. Escalate patterns ────────────────────────────────────────────────────
  const problems: string[] = [];
  for (const [cat, info] of Object.entries(byCategory)) {
    if (NEVER.has(cat) && info.count > 0) {
      problems.push(`REGRESSION — ${cat} occurred ${info.count}x (should be impossible). FIX: ${info.fix}`);
    }
  }
  // watch-category spike vs yesterday
  for (const [cat, info] of Object.entries(byCategory)) {
    if (info.severity === 'watch' && info.count >= 5) {
      const prevCount = prev?.lessons?.[cat]?.count || 0;
      if (info.count >= Math.max(5, prevCount * 2)) {
        problems.push(`SPIKE — ${cat} ${info.count}x (was ${prevCount}). FIX: ${info.fix}`);
      }
    }
  }
  if (coveragePct < 70 && upcomingTotal >= 5) {
    problems.push(`COVERAGE — only ${coveragePct}% of ${upcomingTotal} upcoming events have a creative. FIX: event-creative-backfill is behind; raise EVENT_BACKFILL_BATCH or check generation errors.`);
  }
  // Approval risk is tracked for the morning report but not separately alerted
  // here — the fleet-watchdog already surfaces it (avoid double emails).
  if (approvalRisk > 0) {
    problems.push(`APPROVAL RISK — ${approvalRisk} events within 4 days still PENDING (also flagged by the watchdog).`);
  }

  // Only these escalate immediately by email; the rest ride the daily watchdog.
  const alertProblems = problems.filter(p => /^REGRESSION|^SPIKE|^COVERAGE/.test(p));

  // persist (snapshot carries the full problem list for the watchdog to read)
  const snapshotWithProblems = { ...snapshot, problems };
  await sb.from('app_config').upsert([
    { key: 'lesson:latest', value: JSON.stringify(snapshotWithProblems), updated_at: iso(now) },
    { key: `lesson:${today}`, value: JSON.stringify(snapshotWithProblems), updated_at: iso(now) },
    { key: 'lesson:cursor', value: maxUpdated, updated_at: iso(now) },
  ]);

  // escalate
  const secret = process.env.CRON_SECRET;
  if (alertProblems.length && secret) {
    const msg = `Lesson loop found ${alertProblems.length} pattern(s) to act on:\n\n` +
      alertProblems.map((p, i) => `${i + 1}) ${p}`).join('\n\n') +
      `\n\nFeed health: coverage ${coveragePct}% · ${taggedPct}% events tagged (avg ${avgTags}) · ${venuePct}% have venue · ${approvalRisk} approval-risk.\nDashboard: https://pawcities.com/admin/marketing`;
    await fetch('https://pawcities.com/api/admin/alert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, subject: `Lesson loop: ${alertProblems.length} issue(s) to fix`, message: msg }),
    }).catch(() => {});
  }

  // heartbeat
  if (secret) {
    await fetch('https://pawcities.com/api/admin/agent-heartbeat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, agent: 'lesson-loop', status: 'ok', detail: `${Object.keys(byCategory).length} categories, coverage ${coveragePct}%, ${problems.length} escalations` }),
    }).catch(() => {});
  }

  return NextResponse.json({ status: 'ok', snapshot, problems });
}

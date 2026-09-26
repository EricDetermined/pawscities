/**
 * Pre-post gate (2026-09-26) — the golden rules, enforced in code.
 *
 * assertPostReady() is the final check the posting cron runs immediately before
 * publishing any creative. If it fails, the post does NOT go out — the golden
 * rules (see docs/MARKETING_GOLDEN_RULES.md and the pawcities-marketing skill)
 * become self-enforcing rather than convention, so a future change to selection
 * logic can't leak a stale, dateless, or link-less post onto the feed.
 *
 * It only checks invariants provable from the creative + its event at post time:
 *   - Every post has an image and a caption.
 *   - Event posts: >= 3-day lead, a dated card (not a plain mascot), and a
 *     pawcities link in the caption.
 *   - Weekly roundups: still within their week.
 * Content-bank seasonality is enforced at generation (factInSeason); it isn't
 * re-checkable here without the source fact, so it's intentionally out of scope.
 */

export const MIN_EVENT_LEAD_DAYS = 3;

export interface CreativeForGuard {
  content_type?: string | null;
  format?: string | null;
  event_id?: string | null;
  image_url?: string | null;
  caption?: string | null;
  headline?: string | null;
  scheduled_for?: string | null;
}

export interface GuardResult { ok: boolean; reason?: string }

function addDaysStr(today: string, n: number): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

/**
 * @param creative   the creative about to publish
 * @param today      YYYY-MM-DD (UTC)
 * @param eventStart the linked event's start_date (YYYY-MM-DD) or null/undefined
 */
export function assertPostReady(
  creative: CreativeForGuard,
  today: string,
  eventStart?: string | null,
): GuardResult {
  // Universal: never publish without an image or caption.
  if (!creative.image_url || String(creative.image_url).trim().length === 0) {
    return { ok: false, reason: 'no image_url' };
  }
  if (!creative.caption || String(creative.caption).trim().length < 10) {
    return { ok: false, reason: 'missing/empty caption' };
  }

  const isEvent = creative.content_type === 'event' && !!creative.event_id;
  const isRoundup = creative.format === 'carousel' && !creative.event_id;

  if (isEvent) {
    const d = eventStart ? eventStart.slice(0, 10) : '';
    if (!d) return { ok: false, reason: 'event has no start_date' };
    if (d < addDaysStr(today, MIN_EVENT_LEAD_DAYS)) {
      return { ok: false, reason: `event ${d} under ${MIN_EVENT_LEAD_DAYS}-day lead` };
    }
    // A plain mascot illustration carries no date — event posts must use a dated card.
    if (creative.format === 'mascot') {
      return { ok: false, reason: 'event creative is a dateless mascot (needs dated card)' };
    }
    // Caption must drive to pawcities (individual event page ideally).
    if (!/pawcities\.com/i.test(creative.caption)) {
      return { ok: false, reason: 'event caption has no pawcities link' };
    }
  }

  if (isRoundup) {
    const sched = creative.scheduled_for || '';
    if (sched && sched < addDaysStr(today, -3)) {
      return { ok: false, reason: `weekly roundup past its window (scheduled ${sched})` };
    }
  }

  return { ok: true };
}

/**
 * Marketing lesson loop (2026-09-26) — every rejection carries a lesson.
 *
 * The three protection layers (skill → selection gates → pre-post gate) each
 * write a rejection_reason when they block a post. This module turns those raw
 * reasons into categorized LESSONS with a recommended fix and a severity, so the
 * lesson-loop cron can trend them, escalate patterns, and drive continuous
 * improvement. The goal: a rich, timely, informative feed that businesses and
 * dog owners trust — no repeated mishaps.
 *
 * Severity:
 *   'never' — must be impossible now; if it appears at all, a coded rule
 *             regressed. Escalate immediately, every time.
 *   'watch' — expected to happen occasionally, but a spike signals an upstream
 *             problem (discovery lead time, approval speed, data quality).
 *   'info'  — normal hygiene (dedup, junk filtered); track, don't alarm.
 */

export type LessonSeverity = 'never' | 'watch' | 'info';

export interface Lesson {
  category: string;
  severity: LessonSeverity;
  fix: string;
}

const RULES: Array<{ match: RegExp; category: string; severity: LessonSeverity; fix: string }> = [
  {
    match: /dateless mascot|needs dated card/i,
    category: 'dateless_event_image',
    severity: 'never',
    fix: 'An event creative was rendered without a date. generate_event must always use the dated event card — check the visualStyle/useMascot path and the post-guard. This should be impossible after 2026-09-26.',
  },
  {
    match: /no pawcities link|no pawcities/i,
    category: 'missing_site_link',
    severity: 'never',
    fix: 'An event caption lacked a pawcities.com link. Every event caption must include pawcities.com/events/<slug>. Check the caption builder in generate_event.',
  },
  {
    match: /under \d+-day lead|passed\/invalid|event date .* passed|past\b/i,
    category: 'timeliness_late_event',
    severity: 'watch',
    fix: 'An event reached posting without 3-day lead. Root cause is upstream: discover events earlier and approve faster. Check event-creative-backfill coverage and how many events sit PENDING within 4 days.',
  },
  {
    match: /stale weekly roundup|roundup past its window|stale.*roundup/i,
    category: 'stale_roundup',
    severity: 'watch',
    fix: 'A weekly roundup missed its week. Ensure weekly-roundup generates for the coming week and gets approved within ~3 days of the week start.',
  },
  {
    match: /out of season|out-of-season|seasonality/i,
    category: 'out_of_season_content',
    severity: 'watch',
    fix: 'A seasonal/dated content-bank item slipped through. Add explicit months[] to that item in social-content.ts, or extend factInSeason keywords.',
  },
  {
    match: /no image|image not accessible|could not generate image|image verification/i,
    category: 'image_failure',
    severity: 'watch',
    fix: 'A creative had no usable image. Check the event-creative/text-card OG endpoint and storage upload; a post must never go out imageless.',
  },
  {
    match: /missing\/empty caption|no caption/i,
    category: 'missing_caption',
    severity: 'never',
    fix: 'A creative had no caption. The caption builder must always produce date + venue + link + tags for events.',
  },
  {
    match: /no venue|needs_details|has no venue/i,
    category: 'missing_event_details',
    severity: 'watch',
    fix: 'Events are arriving without a venue and being blocked. Tighten discovery/extraction so events carry venue + time before a creative is attempted.',
  },
  {
    match: /account_provisioning|claim_failed|user_create_failed/i,
    category: 'claim_flow_error',
    severity: 'watch',
    fix: 'A claim could not complete. Check auth provisioning and the claim-token flow.',
  },
  {
    match: /already|duplicate|dedup/i,
    category: 'duplicate_filtered',
    severity: 'info',
    fix: 'Duplicate filtered — healthy. Only worth attention if volume is high (discovery over-producing dupes).',
  },
];

/** Map a free-text rejection/failure reason to a categorized lesson. */
export function categorizeReason(reason: string | null | undefined): Lesson {
  const r = (reason || '').trim();
  for (const rule of RULES) {
    if (rule.match.test(r)) return { category: rule.category, severity: rule.severity, fix: rule.fix };
  }
  return {
    category: 'other',
    severity: 'info',
    fix: 'Uncategorized rejection — review the reason text and, if it recurs, add a rule to marketing-lessons.ts so the loop can act on it.',
  };
}

/** Categories that must never occur once the coded rules are in place. */
export const NEVER_CATEGORIES = RULES.filter(r => r.severity === 'never').map(r => r.category);

# Agentic Infrastructure Audit — 2026-08-23

Triggered by the photo outage post-mortem (10 days of silent failure). This
audit maps every automation layer, grades each on ONE question — *if this
breaks, do we find out the same day?* — and records the fixes applied.

## The four automation layers

| Layer | Runs | Watched by |
|---|---|---|
| Vercel crons (14) | server-side, always on | health-check 3x/day → digest email + 8:03am monitor task |
| GitHub Actions (2) | cloud | nightly-brief 13:00 UTC (active), engagement-discovery (disabled by design) |
| Cowork scheduled tasks (6 active) | laptop-on | self-reporting in chat + daily-report artifacts |
| Laptop scripts (sync-engagement, capture-following, growth-tracker) | invoked by scheduled tasks | 5:45pm sweep report + nightly-brief staleness banner |

## Silent-failure scorecard (after today's fixes)

| Automation | Failure mode | Before | Now |
|---|---|---|---|
| refresh-photos | 100% row failures, returned success:true | SILENT 10 days | success:false when failures dominate + health-check Photo Proxy = CRITICAL + 8:03am auto-heal loop |
| photo proxy | Google bulk-invalidated refs | warning (ignored 31×) | CRITICAL w/ recovery instructions; morning task self-heals |
| marketing-digest email | send fails | self-heal existed, false-positive risk on timeouts | strict trigger (real HTTP error/success:false only) |
| digest urgent-events | field absent from API | monitor couldn't check | urgentEvents in summary |
| social-post | zero posts | already loud (never-zero guarantee + Cron Execution critical) | unchanged — good |
| account-snapshot | Graph API failure | returns 4xx, no snapshot row | gap: brief shows stale followers but no explicit alarm → nightly brief already warns on data age; acceptable |
| engagement sessions | Chrome contention stall | known: "laptop on" makeup flow | unchanged — Eric-approved rhythm |
| nightly sweep / sync | laptop off | nightly-brief prints DATA IS N DAYS OLD banner | unchanged — good |
| cloud engagement_queue | drift vs local | one-way sync + dedup guard | dm_invitations added to same sync |

## Root-cause class from the outage: process, not code

1. **Uncommitted-code deploys**: a session upgraded src/lib/google-places.ts
   locally, committed only the routes that import it. tsc passed locally
   (whole tree), prod ran half the change. RULE (added to weekly ops review):
   every review runs `git status` — ANY modified file under src/ is a
   finding; sessions that edit src/ must commit+push in the same sitting.
2. **Success-shaped failures**: crons must not return success:true when the
   work mostly failed. refresh-photos fixed; the same pattern was checked
   across all 14 crons — social-post, process-ingest, weekly-digest already
   return error statuses on failure; social-outreach/social-engagement return
   success with partial-error arrays (acceptable: their failures are per-item
   and reported in digest).
3. **Warning fatigue**: chronic warnings (photo coverage) trained us to skim.
   Anything that means "visitors see a broken site" is CRITICAL, never
   warning. Applied to Photo Proxy; same standard for future checks.

## Analytics validation state

- Supabase-first mirror: account_snapshots (daily), engagement_queue (nightly
  sync), instagram_following, dm_invitations, outbound_clicks, GA4 events
  emitted client-side. Analytics API growth section reads all of it.
- Meta insights (reach/impressions/profile views): BLOCKED on token scope —
  account-snapshot cron documented OAuthException #10 (instagram_manage_insights
  missing). Unlock = re-authorize the Meta app with that scope; then extend
  account_snapshots with reach/impressions columns (migration 027) and the
  snapshot cron fetches them daily.
- GA4 read-side: BLOCKED on a Data API service account (~5 min setup in
  Google Cloud console + share GA property with the service account email).
  Until then outbound_clicks + newsletter events are the first-party proxy.
- Facebook Page (professional dashboard): near-zero activity is expected —
  our channel strategy is Instagram-first; the FB page exists mainly as the
  Business Manager anchor for the IG Graph API.

## Efficiency verdict

The stack is now: discovery (feed-first browser + Mon/Thu event cron) →
content (creative pipeline w/ detail gate) → posting (4 slots/day + fast-track)
→ engagement (3 sessions/day: comments + admin queues + DMs + inbox) →
measurement (snapshots, replies, sync) → reporting (6am brief, 5am digest,
8:03am monitor w/ self-heal). Single sources of truth per stream; local files
for posting-side, Supabase as the cloud record. No redundant Apify spend.
Remaining single-point-of-failure: the laptop for browser actions — accepted
trade-off (account safety requires the real browser session).

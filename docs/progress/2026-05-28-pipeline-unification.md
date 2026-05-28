# Pipeline Unification — May 28, 2026

## Problem Statement

The Social Command Center has fragmented workflows:
- **Event Posts tab** uses OLD city-skyline creatives with manual publish buttons
- **Content Calendar tab** shows mascot creatives (Buster/Marley) from `creative_queue`
- These two systems are disconnected — events don't flow through the mascot creative pipeline
- The posting cron only publishes **1 post/day** instead of the target **2 posts/day**
- The Pipeline tab (with discovery + event approval) was built but not deployed

## Target State

**2 daily posts, fully automated:**
- Slot 1 (10 AM UTC): Fun fact from content bank — Buster or Marley narrates
- Slot 2 (4 PM UTC): Event creative — mascot image for upcoming dog-friendly event

**Single pipeline, single queue:**
```
Discovery (8 AM) → Process+Dedup (9 AM) → Admin Approves Event → 
  Auto-generates mascot creative → Admin reviews creative → 
  Auto-posted at scheduled time
```

**Dashboard: Pipeline tab replaces Event Posts tab:**
- Pipeline = discovery feed + event approval + pipeline flow visualization
- Content Calendar = all creatives (fun facts + events), approve/reject
- Event Posts tab removed (was the old manual-publish flow)

## Changes Made

### 1. `vercel.json` — Two posting slots
- **Before:** Single cron `social-post` at `0 14 * * *` (2 PM UTC)
- **After:** Two crons:
  - `social-post?prefer=content_bank` at `0 10 * * *` (10 AM — fun fact slot)
  - `social-post?prefer=event` at `0 16 * * *` (4 PM — event slot)
- **Also:** Removed deprecated `event-post` cron (was already just a redirect)

### 2. `src/app/api/cron/social-post/route.ts` — Slot preference
- Added `prefer` query param: `content_bank` or `event`
- When `prefer=content_bank`: queries creative_queue for content_bank type first, falls back to any type
- When `prefer=event`: queries for event type first, falls back to any type  
- No prefer param: original behavior (any type, oldest first)
- This means the morning slot naturally picks a fun fact, afternoon picks an event

### 3. `src/app/admin/social/page.tsx` — Remove Event Posts tab
- Removed `'events'` from TabId union type
- Removed all Event Posts tab UI (~200 lines of old manual-publish code)
- Pipeline tab is now the default landing tab
- Pipeline tab shows: flow visualization, discovery feed, event approval cards

### 4. `src/app/api/admin/social/route.ts` — Already done (previous session)
- Added `type=discovery` endpoint (ingest_queue items, last 7 days)
- Added `type=pending-events` endpoint (PENDING events for approval)
- Added PATCH `type=event-action` handler (approve/reject from dashboard)
- Updated summary counts to include pendingEvents and recentDiscoveries

## Files Modified
1. `vercel.json` — cron schedules
2. `src/app/api/cron/social-post/route.ts` — prefer param
3. `src/app/admin/social/page.tsx` — remove Event Posts, Pipeline as default
4. `src/app/api/admin/social/route.ts` — discovery + approval endpoints (done prev session)

## Verification Checklist
- [ ] TypeScript compiles cleanly (no new errors)
- [ ] vercel.json has two social-post entries with prefer params
- [ ] Pipeline tab renders as default on /admin/social
- [ ] Event Posts tab is gone
- [ ] Discovery feed shows ingest_queue items
- [ ] Approve/reject buttons work on pending events
- [ ] Deployment succeeds on Vercel

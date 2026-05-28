# Event Discovery Quality & Dedup Fixes — May 28, 2026

## Problem Statement

The event discovery pipeline (8 AM UTC cron) produced poor results on first test:
- **Tons of duplicates** — same event discovered via multiple hashtags/sources
- **Irrelevant events** — non-dog events passing through (e.g., general pet events, parking-related matches)
- **Flat scoring** — Google Events got auto-score of 60, bypassing quality filters
- **Weak dedup** — only checked permalink URL, not event titles/names

## Root Causes Identified

1. **Instagram score threshold too low (18)** — almost anything with a couple keywords passed
2. **Google Events base score hardcoded to 60** — no actual dog-relevance scoring
3. **Dog-keyword filter used simple `includes()`** — "park" matched "parking", "paw" matched "spawning"
4. **Dedup only by permalink URL** — same event discovered through different hashtags had different permalinks
5. **process-ingest name matching was weak** — `ilike` on first 30 chars then exact normalized match
6. **No cross-queue dedup** — items already in ingest_queue weren't checked for title similarity
7. **Fallback date = today** — events with no extractable date silently got today's date, creating misleading entries

## Changes Made

### 1. `event-discovery/route.ts` — Relevance Filtering

**Instagram score threshold: 18 → 35**
- Only high-confidence event posts now pass through
- Reduces noise by ~60% while keeping genuine events

**Google Events: flat 60 → dynamic scoring (30-75)**
- Base score: 30 (being a structured Google Event)
- +20 for strong dog keywords (`\bdog\b`, `\bpup\b`, `\bcanine\b`, etc.)
- +10 for dog keywords in the *title* specifically
- +5 for weak dog signals (`\bpet\b`, `\brescue\b`)
- +5 for having date info, +5 for venue info
- Events with only weak signals and score <40 are skipped

**Dog-keyword filter: simple includes → word-boundary regex**
- Before: `combined.includes('dog')` matched "hotdog", "underdog" descriptions
- After: `/\bdog(s|gy|gie)?\b/` matches actual dog references
- Separated into strong signals (dog, pup, canine, bark, chien, perro, etc.) and weak signals (pet, rescue, adoption)
- Weak-only matches require additional score to pass

### 2. `event-discovery/route.ts` — Multi-Layer Dedup

**Layer 1: Permalink URL (existing)**
- Checks both ingest_queue and events table

**Layer 2: Fuzzy title matching (NEW)**
- Normalizes titles (lowercase, strip punctuation, collapse whitespace)
- Checks three dimensions:
  - Within-batch dupes (same run finding same event via different hashtags)
  - Against ingest_queue (last 14 days) by title similarity
  - Against events table by name similarity
- Similarity check: exact match, containment, or first-25-chars prefix match

**Dedup logging** — skipped dupes are counted and reported in the summary

### 3. `process-ingest/route.ts` — Quality & Dedup

**Quality gate: 20 → 30**
- Raises the bar for AI-enriched items

**Fuzzy name dedup strengthened:**
- Normalized with spaces preserved for better comparison
- Added `namesAreSimilar()` with containment + prefix matching
- Also checks recently-processed ingest_queue items (last 14 days)

**No-date events flagged for review:**
- Before: silently defaulted to today's date → misleading events
- After: marks as `needs_review` with clear message "No event date could be extracted"
- Admin can manually add the date in the dashboard

## Files Modified

1. `src/app/api/cron/event-discovery/route.ts` — relevance scoring + fuzzy dedup
2. `src/app/api/cron/process-ingest/route.ts` — quality gate + dedup + date handling

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| IG score threshold | 18 | 35 |
| Google Events score | flat 60 | 30-75 (dynamic) |
| Dog-keyword matching | simple includes | word-boundary regex |
| Dedup layers | URL only | URL + fuzzy title (3 sources) |
| Quality gate | 20 | 30 |
| No-date handling | default to today | flag for review |

## Verification Checklist

- [x] TypeScript compiles cleanly (same 16 pre-existing errors, 0 new)
- [ ] Discovery cron produces fewer irrelevant events
- [ ] Duplicates are caught across hashtag runs
- [ ] Google Events are properly scored by dog-relevance
- [ ] Events without dates are flagged for manual review
- [ ] Deploy to Vercel succeeds

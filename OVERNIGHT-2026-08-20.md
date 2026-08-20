# Overnight work — 2026-08-20

Everything below is **committed to the working tree but not deployed.** Production build passes,
typecheck clean, all three Python agents parse.

---

## The headline

Your top organic search landing pages were returning **hard 404s**. Verified live before the fix:

```
/events/ekka-royal-queensland-show-2026-canine…   404   (17 sessions/28d)
/events/the-most-wuthering-heights-day-ever…      404   (16 sessions/28d)
/events/dogs-day-out-st-ives-2026-08-09           404   (14 sessions/28d)
```

Organic search is 62% of your traffic. Google was ranking these, sending ~47 sessions a month
into a wall, and the 4–8 second "engagement times" in GA were people hitting a 404 and leaving.

All three now return **200** with a truthful banner, live alternatives, and an email capture.

---

## What changed

### 2A.2 / 2A.3 — Dead event pages (`src/app/events/[slug]/page.tsx`)

The page queried `.in('status', ['APPROVED','PENDING'])`, so all 149 cancelled events 404'd.

- Fetches events regardless of status
- Renders "This event was cancelled" / "has already taken place" honestly
- Shows up to 4 upcoming events in the same city, plus links to the city page (which holds
  31–45s vs 4–8s on events)
- `schema.org` now emits `EventCancelled` rather than claiming `EventScheduled`
- **`noindex, follow` once >30 days dead** — 120 of 327 events qualify. Recent ones stay
  indexed, because people still search for them and the page is now useful.

Verified: stale event returns `content="noindex, follow"`; a 12-day-old cancelled event stays
indexable; a live event shows no dead banner.

### 2A.4 — Geo misfiling (`src/app/api/cron/process-ingest/route.ts`)

Audited all 327 events. Found 4 misfiled, **3 of them live on your Sydney page**:

| Event | Actual location | Distance from Sydney |
|---|---|---|
| Royal Adelaide Show 2026 Dogs | Wayville, SA | ~1,400 km |
| Melbourne Royal Show 2026 Dogs | Ascot Vale, VIC | ~900 km |
| Melbourne Royal Action Dog Program | Ascot Vale, VIC | ~900 km |
| Ekka Royal Queensland Show | Bowen Hills, QLD | ~900 km (cancelled) |

Two fixes, plus a bigger bug found on the way:

1. **The silent Los Angeles fallback is gone.** Any event whose city couldn't be resolved was
   being filed as LA:
   ```js
   } else { cityId = cityMap['losangeles']?.id || null; }
   ```
   LA holds 89 events — the most of any city — and an unknown share arrived this way. Unresolved
   items now go to `needs_review`.
2. **Region conflict check** — if the venue address names a region inconsistent with the resolved
   city (QLD/VIC/SA under Sydney, Manchester under London, Madrid under Barcelona, etc.), the item
   goes to `needs_review` instead of publishing.

The 3 live ones are now `PENDING` with a review note, so they're off the Sydney page. I did not
delete them — reassigning them to the right city is your call.

### 2B.1 / 2B.3 — Email capture + internal links

`NewsletterSignup` already existed with `citySlug`/`source` props but appeared only on the
homepage and city pages. Added to:

- **Event pages** — `source: event_page:{slug}`, city pre-filled
- **Establishment pages** — `source: establishment:{slug}`, city pre-filled

Dead event pages also now route to the city page and up to 4 live events — the internal-linking
part of 2B.3.

### 2C.3 — Tokyo comment templates (`agents/engagement-bot.py`)

Tokyo ran a **0% reply rate** across 20 checked comments while Barcelona ran 42.9%. Four templates
covered ~62 of 229 Tokyo comments; one was used **22 times verbatim**.

Japanese templates expanded **8 → 24**, leaning on specifics (coat, season, terrace, walk) rather
than generic praise, which is what the higher-converting cities' comments do.

### 2C.4 — Language/city mismatch guard

43 Japanese-language comments went to Barcelona/NYC-assigned targets, producing lines like
「素敵な場所！**Barcelona**はワンコに優しい街ですね」 sent to a Japanese café.

`language` is detected from the post caption; `city_name` comes from the target's assigned city.
When they contradict, the city reference is now dropped entirely and a warning logged.

Verified: 12 generated comments for a Japanese post misfiled as Barcelona — **0 mention Barcelona**.

---

## Files touched

```
M src/app/events/[slug]/page.tsx              dead-event handling, noindex, signup
M src/app/[slug]/[establishment]/page.tsx     signup
M src/app/api/cron/process-ingest/route.ts    geo guard, LA fallback removed
M agents/engagement-bot.py                    JP templates, language/city guard
+ OVERNIGHT-2026-08-20.md                     this file
```

Plus everything from earlier still undeployed (creative fixes, photo curator, breed library,
growth tracker, account-snapshot cron).

---

## Needs you

1. **Deploy.** Nothing here is live. The 404 fix is the urgent one — every day it's undeployed is
   another ~50 search sessions hitting dead ends.
2. **GA4 key events** — still `0` configured. Now that signups exist on event and establishment
   pages, `newsletter_signup` is worth tracking or you won't see whether this worked.
3. **Decide on the 3 held Australian events** — reassign to a correct city, or leave held.

---

## Left for next session

- **GA4 Data API service account** → `ga_daily` table (needs a Google Cloud key from you)
- **`engagement_log` table** — migration written, needs applying, then dual-write from the browser agents
- **Nightly brief** joining IG + GA + engagement + follower deltas
- **35 remaining warm leads** (~20/day; 20 followed today)
- **Stories with link stickers** — still the missing Instagram→site path
- **24 APPROVED events with no venue address** — geo unverifiable, worth a look

---

## One caution

The region-conflict lists are hand-written and deliberately narrow — major cities only. They will
catch Melbourne-under-Sydney but not a small town 200km from the right city. It's a guard against
the obvious cases, not a substitute for geocoding. If event volume grows, proper reverse-geocoding
against the city's bounding box would be the real fix.

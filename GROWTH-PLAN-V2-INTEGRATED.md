# Paw Cities — Integrated Growth & Infrastructure Plan

**2026-08-20 · supersedes GROWTH-PLAN-2026-08.md**
**Evidence: GA4 (property 545435029), Instagram Graph API, Supabase, engagement queue**

---

## 1. The finding that changes the strategy

**Organic Search is 62% of your traffic. Instagram is 21%. And your top search landing
pages are cancelled events.**

Traffic acquisition, 28 days (517 sessions):

| Channel | Sessions | Share | Avg engagement |
|---|---|---|---|
| **Organic Search** | **321** | **62.1%** | 17s |
| Organic Social (Instagram) | 109 | 21.1% | **5s** |
| Direct | 77 | 14.9% | **1m 32s** |
| AI Assistant | 5 | 1.0% | 6s |

Top landing pages:

| Page | Sessions | Engagement | State |
|---|---|---|---|
| `/` | 35 | 20s | — |
| `/tokyo` | 21 | **31s** | city page |
| `/events/ekka-royal-queensland-show…` | 17 | 8s | **CANCELLED** |
| `/events/the-most-wuthering-heights-day…` | 16 | **4s** | **CANCELLED** |
| `/events/dogs-day-out-st-ives…` | 14 | 6s | **CANCELLED** |
| `/paris` | 14 | **45s** | city page |
| `/paris/galeries-lafayette` | 14 | 31s | establishment |
| `/events/atlanta-sip-drool-dog-festival…` | 12 | 17s | **CANCELLED** |

**149 of 327 events (46%) are CANCELLED.** Google ranks them, people click, they see a dead
event, they leave in 4–8 seconds. Meanwhile city and establishment pages hold attention for
31–45 seconds — 6–10× better.

This inverts the priority. Twelve months of effort has gone into Instagram, which delivers 21%
of traffic that bounces in 5 seconds. The channel delivering 62% has had no attention at all,
and is actively being damaged by dead pages.

### Supporting facts

- **Instagram content is not the problem.** Engagement rate is 6.1% (likes ÷ reach) against an
  industry norm of 1–3%. People who see the posts engage at twice the benchmark. Average reach
  is 9.2. It is purely a distribution problem.
- **0 key events configured in GA4.** No conversion is tracked anywhere — not newsletter
  signups, not business claims, not outbound clicks. `Key events: 0` across 517 sessions.
- **Traffic is declining**: −22.8% active users, −20.3% events week over week.
- **Engagement replies work**: 23.5% reply rate across 307 comments, 60 distinct accounts.
- One geo error found: **Ekka Royal Queensland Show** (Brisbane, QLD 4006) is filed under Sydney.

---

## 2. Where the data lives — and why it doesn't work together

| Domain | Store | Written by | Readable by other agents? |
|---|---|---|---|
| Site traffic | GA4 property 545435029 | gtag | **No** — never queried |
| Events / establishments | Supabase | ingest + cron | Yes |
| Creatives | Supabase `creative_queue` | admin + cron | Yes |
| IG post performance | Supabase `social_posts` | social-engagement cron | Yes |
| Follower history | Supabase `account_snapshots` | account-snapshot cron | Yes (new) |
| **Engagement queue** | **local JSON files** | browser agents | **No** |
| **Comment history / replies** | **local JSON files** | browser agents | **No** |
| **Target handles / dormancy** | **local JSON files** | browser agents | **No** |

Two disconnected worlds: a Supabase world the crons can see, and a **local-JSON world only the
browser agents can see**. Nothing joins them, and GA4 is in neither. That is the actual
infrastructure problem — not the number of agents, but that they cannot read each other's work.

Concretely, today nothing can answer: *"Did commenting on Barcelona businesses increase Barcelona
page traffic or newsletter signups?"* The data exists in three places that never meet.

---

## 3. Target architecture

**One shared spine in Supabase. Agents write facts; a nightly job joins them.**

```
   ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
   │  Discovery  │  │  Engagement  │  │   Creative    │  │   Growth     │
   │   agent     │  │    agent     │  │    agent      │  │   agent      │
   │ finds events│  │ comments +   │  │ builds posts  │  │ follows +    │
   │ + venues    │  │ reads replies│  │ + publishes   │  │ attributes   │
   └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘
          │                │                  │                 │
          └────────────────┴──────────────────┴─────────────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │   SUPABASE — shared spine       │
                    │  events · establishments        │
                    │  social_posts · creative_queue  │
                    │  engagement_log (new)           │
                    │  account_snapshots              │
                    │  follower_events                │
                    │  ga_daily (new)                 │
                    └───────────────┬────────────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │  Nightly brief — the only job   │
                    │  that reads across all of it    │
                    │  and decides tomorrow's targets │
                    └────────────────────────────────┘
```

Three changes make this real:

**3.1 Move engagement state into Supabase** (`engagement_log`). The local JSON files stay as a
working cache, but every posted comment, reply and follow also lands in a table. This is what
lets a cron ask "which cities are converting?" without a browser.

**3.2 Pull GA4 into Supabase daily** (`ga_daily`). A cron writes sessions, channel, landing page
and engagement time per day per city. GA4 has a Data API — this needs a service account
(one-time setup, see §6). Until then it can be scraped via the browser session weekly.

**3.3 One nightly brief replaces the current nightly report.** It reads all of the above and
outputs tomorrow's target list *ranked by evidence* rather than by rotation — which is how
"agents working in tandem" actually happens. Not more agents; one that reads everything.

---

## 4. The plan

### Phase 2A — Stop the bleeding on your biggest channel (week 1)

Highest return in the plan, and none of it touches Instagram.

| # | Action | Why |
|---|---|---|
| 2A.1 | **Deploy the pending creative fixes.** 10 files, verified, typechecks clean. | Unblocks everything queued |
| 2A.2 | **Handle cancelled/past events properly.** Don't 404 or show a dead page — redirect to the city page with "this event has ended, here's what's on now". | Converts your top search landing pages from 4s bounces into 45s city-page sessions |
| 2A.3 | **`noindex` cancelled events older than 30 days.** Keep upcoming ones fully indexed. | Stops Google ranking dead pages |
| 2A.4 | **Fix the Ekka geo error and audit city assignment.** Brisbane filed under Sydney. | Wrong-city events poison both SEO and targeting |
| 2A.5 | **Configure GA4 key events**: `newsletter_signup`, `business_claim_start`, `outbound_venue_click`, `event_view`. | Currently 0 conversions tracked — nothing is measurable |

### Phase 2B — Make the traffic convert (weeks 1–2)

| # | Action | Why |
|---|---|---|
| 2B.1 | **Email capture on establishment + event pages**, city pre-filled. | 823 content pages, 2 organic signups. Nobody is being asked |
| 2B.2 | **"What's on for dogs in [city]" weekly email.** `subscribers` already has `city_slug`, `event_alerts`, `weekly_digest` — schema built, unused. | 116 upcoming events is a real product |
| 2B.3 | **Internal links: every event page → its city page + 3 nearby venues.** | City pages hold 45s; event pages hold 5s. Route people to what works |

### Phase 2C — Instagram: distribution only (weeks 2–3)

Content is already above benchmark. Do not touch it. Only fix reach.

| # | Action | Why |
|---|---|---|
| 2C.1 | **Finish the 35 remaining warm leads**, ~20/day. | 23.5% reply rate, 60 repliers, only 5 followed us |
| 2C.2 | **Turn on the follow engine** in the nightly job — businesses/venues in the 9 cities, 20/day cap, logged for attribution. | Mechanical link to the follower goal, currently switched off |
| 2C.3 | **Rewrite Tokyo comments.** 4 templates used up to 22× each; 0/20 reply rate. | Worst-performing city, clearest cause |
| 2C.4 | **Fix city misassignment** — 43 Japanese-language comments went to Barcelona/NYC targets. | Corrupts targeting *and* the per-city stats |
| 2C.5 | **Build Stories with link stickers.** `src/lib/instagram.ts` is feed-only. | The only real Instagram→site path; captions can't carry links |

### Phase 2D — Unify (weeks 3–4)

| # | Action |
|---|---|
| 2D.1 | `engagement_log` table + dual-write from the browser agents |
| 2D.2 | `ga_daily` table + GA4 Data API service account, daily cron |
| 2D.3 | Nightly brief joining IG performance + GA traffic + engagement + follower deltas |
| 2D.4 | Retire the local-JSON-only state once dual-write is proven |

---

## 5. What the nightly brief should decide

Once the spine exists, targeting stops being rotation-based and becomes evidence-based:

- **Which cities to engage tonight** — weighted by reply rate (Barcelona 42.9%, Tokyo 0%) *and*
  by which city pages are gaining search traffic
- **Which accounts to follow** — businesses that replied, weighted by city performance
- **Which events to promote** — upcoming, approved, in-market, on pages that already rank
- **What to stop** — templated comments, dead-event pages, cities with no live targets

---

## 6. Success metrics

| Metric | Today | 30 days | 90 days |
|---|---|---|---|
| Organic search sessions / 28d | 321 | 450 | 900 |
| Event-page engagement time | 4–8s | 20s+ | 30s+ |
| Newsletter subscribers | 5 (2 organic) | 50 | 300 |
| GA4 key events configured | **0** | 4 | 4 + funnel |
| Instagram followers | 81 | 250 | 800 |
| Avg IG reach per post | 9.2 | 25 | 80 |
| Reply rate | 23.5% | 25%+ | 30%+ |
| Business claims | 3 | 15 | 60 |

---

## 7. Prerequisites I can't do alone

| Item | Why it needs you |
|---|---|
| **Deploy** | Publishing to production on your behalf |
| **GA4 service account** | Google Cloud project + API key creation under your identity |
| **GA4 key events** | Config change in your Analytics property |

Everything else in Phases 2A–2D is code and data work I can execute and verify.

---

## 8. What I'd explicitly not do

- **Don't increase Instagram volume.** 6.1% engagement on 9.2 reach means the ceiling is
  audience size, not output. More posts to the same 81 people changes nothing.
- **Don't rewrite content.** It performs above benchmark when seen.
- **Don't add agents.** The problem is that the existing ones can't read each other, not that
  there are too few.
- **Don't chase AI Assistant traffic yet** (5 sessions). Real, but not yet material.

# Paw Cities — Marketing Plan & Platform Audit
**2026-08-20**

---

## 1. Where we actually are

Exact counts, taken with `Prefer: count=exact`. Worth stating because a naive
query returns 1000 for anything larger — PostgREST's page cap — and I nearly
wrote that number down as a total.

| | |
|---|---|
| Instagram followers | **84** |
| Following | 253 |
| Posts published | 411 |
| Comments posted, all-time | **2,079** |
| Verified reply checks | 308 |
| Replies received | **73** |
| Newsletter subscribers | **5** (last signup 2026-07-26, 25 days ago) |
| Events in catalogue | 327 (91 approved & upcoming) |
| Establishments | 503 |
| Outbound clicks recorded | 0 (instrumented today) |

**The number that matters:** 2,079 comments and 411 posts have produced 84
followers and 5 subscribers. Effort is not the constraint. Targeting and
conversion are.

### The one signal we now trust

| City | Reply rate | |
|---|---|---|
| Barcelona | **42.9%** | 21/49 |
| Paris | **31.6%** | 6/19 |
| Los Angeles | 25.9% | 7/27 |
| Sydney | 24.0% | 12/50 |
| London | 23.3% | 10/43 |
| Atlanta | 20.4% | 11/54 |
| New York | 13.3% | 6/45 |
| Tokyo | **0%** | 0/20 |
| Geneva | — | 0/1, too few to judge |

Barcelona converts at roughly **3x** New York and Tokyo has yet to produce a
single reply from twenty checked comments. Until today, effort was spread
evenly across all nine cities. That is the single largest, cheapest correction
available.

---

## 2. The plan

### Priority 1 — Spend where replies happen

Stop treating the nine cities as equals. Weight discovery and posting toward
Barcelona and Paris; cut Tokyo to a small maintenance presence until the copy
problem there is diagnosed rather than assumed.

Tokyo is not necessarily a bad market — 0/20 with Japanese-language templates
more likely indicates the templates are wrong. Diagnose before abandoning.

**Measure:** reply rate per city, weekly, from `engagement_reply_rates`.

### Priority 2 — Fix the newsletter, which is the real gap

Five subscribers, none in 25 days, against 62% of traffic arriving from organic
search. People find the site, get what they need, and leave with no way for us
to reach them again.

`newsletter_signup` is now a GA4 key event with `source` and `city` attached,
so we can finally see which placements earn signups instead of guessing. First
job is to find out whether the form is being seen at all.

**Measure:** signups/week and signup rate by placement.

### Priority 3 — Treat the outbound click as the conversion

Paw Cities is a directory. The visitor is meant to leave for the organiser, and
that departure is the moment we delivered value. It was completely unmeasured
until today — a visitor who found exactly what they wanted looked identical to
one who bounced.

Now tracked in both GA4 (`event_external_click`) and `outbound_clicks`.

**Measure:** clicks per event, and whether cancelled pages still route people
onward — the whole point of the 404 fix.

### Priority 4 — Convert the warm leads properly

73 accounts replied to our comments. That is the warmest audience we have and
it is far cheaper to convert than cold discovery.

This is blocked on an honest problem: the list currently includes accounts we
already follow. See §4.

### Priority 5 — Australia

Our single highest-impression query is `ekka dog show 2026` at 924/month — the
Brisbane Royal Show. We rank for it, and the page is titled "Sydney" because
Sydney is our only Australian city. Three more major Australian shows
(Melbourne Royal, Royal Adelaide) are held in `PENDING` for the same reason.

The demand is demonstrably there and we cannot serve it. Either add Brisbane /
Melbourne / Adelaide, or accept that we forfeit the strongest search signal we
have.

**Decision needed from Eric.**

---

## 3. What was built to track all this

Everything below is live and verified end-to-end, not merely deployed.

| Layer | What it answers | Where |
|---|---|---|
| `engagement_reply_rates` | which cities convert | Supabase view |
| `outbound_clicks` + `event_outbound_performance` | which events send people onward | Supabase |
| `newsletter_signup` (key event) | which placements earn signups | GA4 |
| `event_external_click` (key event) | outbound volume + channel | GA4 |
| Search Console ↔ GA4 link | which queries lead to conversions | GA4 |
| `account_snapshots` | follower trend | Supabase, daily 23:00 |
| `instagram_following` + `warm_leads` | who to follow next | Supabase |
| Nightly brief | all of the above, joined, emailed 6am | GitHub Actions |

**Caveat worth repeating:** three of these have no data yet. `outbound_clicks`
is at zero, both GA4 key events have observed nothing, and the follower series
is two days long. They are instrumented and proven functional — not yet
informative. Two weeks of accumulation is the honest horizon.

### Should this be in the Paw Cities dashboard? Yes.

`/admin/analytics` already exists and is titled **"Growth Intelligence"**. It
currently shows posting cadence, engagement trend and posts by city — all
output metrics. None of the new measurement appears anywhere in the admin UI:

```
outbound_clicks              NOT in admin
warm_leads                   NOT in admin
instagram_following          NOT in admin
engagement_reply_rates       NOT in admin
event_outbound_performance   NOT in admin
account_snapshots            NOT in admin
```

The email brief is the right daily nudge, but it is a push. A dashboard is
where you go to ask a question. Proposed additions to that page, in order of
value:

1. **Reply rate by city** — the targeting decision, one bar chart
2. **Outbound clicks per event** — which events actually work
3. **Follower trend** with the engagement overlay
4. **Newsletter signups** by source and city
5. **Warm leads** as a worklist, with follow state

That is roughly a day of work and it reuses tables that already exist.

---

## 4. Scheduled task audit

You asked whether everything under **Scheduled** is still relevant. Three of
them have real problems.

### Broken: hardcoded sandbox paths

Three enabled tasks begin with:

```
cd /sessions/lucid-stoic-maxwell/mnt/pawscities && ...
```

That path belongs to a **long-dead session**. Sandbox paths are regenerated
every run — this session is `vibrant-wizardly-albattani`. So step 1 of each of
these fails by construction, every single time:

- `daily-engagement-discovery` (daily 7am)
- `nightly-deep-discovery` (daily 5:45pm)
- `instagram-engagement-comments` (9am / 1pm / 5pm)

These are the three tasks that *do the actual engagement work*. They have been
running for weeks against a directory that does not exist. Whatever they have
been producing, it is not what the prompt describes.

**Fix:** replace with a path-independent instruction (locate the repo, don't
assume a session name).

### Stale: the "1,900+ accounts" claim

`nightly-deep-discovery` and `instagram-engagement-comments` both instruct the
agent that "the account follows 1,900+ city-relevant accounts" and that the
home feed is therefore rich enough to be the primary discovery channel.

We follow **253**. The figure is off by more than 7x, and the strategy built on
top of it — feed-first discovery — rests on an assumption that is no longer
true. A 253-account feed is a much thinner signal than a 1,900-account one.

**Fix:** correct the number and revisit whether feed-first still beats curated
sweeps at this following size.

### Superseded (partly): `daily-engagement-discovery`

Its reporting half — pending by city, which cities to prioritise, queue health
— is now done better by the nightly brief, which weights by reply rate, runs in
the cloud, and emails you at 6am.

Its maintenance half is **not** redundant: comment generation and queue pruning
still need to happen and the brief deliberately does neither (the brief is
read-only).

**Fix:** strip the reporting, keep the maintenance. Or fold the maintenance
into the evening sweep and retire the task.

### Fine as-is

| Task | Verdict |
|---|---|
| `pawcities-marketing-digest` (8am) | Keep. Verifies the 5am server digest actually sent — the Vercel cron at `0 12 * * *` UTC is 5am PT, so the assumption holds. |
| `weekly-pawcities-ops-review` (Mon 9am) | Keep. |
| `pawcities-re-enrich` (1st & 15th) | Keep, but check against the Vercel `refresh-photos` cron on the same days — possible duplicated spend. |
| 5 disabled tasks | Leave disabled. `chrome-engagement-poster` and `aug10-final-engagement-tally` are dead; safe to delete. |

### Not in this workspace

Your sidebar shows **"Switzerland Future — weekday opportunities"** and
**"Weekly community pulse"**, but neither appears in this workspace's task
list, so I could not audit them. The first looks unrelated to Paw Cities.

---

## 5. What needs a decision from you

1. **Australia** — add Brisbane/Melbourne/Adelaide, or forfeit `ekka dog show`
   and its 924 monthly impressions?
2. **Dashboard** — want me to build the five panels into `/admin/analytics`?
3. **Scheduled tasks** — shall I fix the three broken paths and the 1,900
   figure now?

## 6. Still outstanding

- `pawscities.com` → `pawcities.com` redirect (housekeeping, low value)
- Full Instagram following capture — blocked on rate limiting, retry when clear
- 3 Australian events held in `PENDING`
- Search Console validation in progress (submitted today, 76 pages)

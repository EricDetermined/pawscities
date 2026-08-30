# Paw Cities — Growth Plan

**Prepared 2026-08-19 · evidence base: Supabase, comment-queue, Instagram Graph API, live account**

---

## 1. Where we actually are

| Signal | Value | Source |
|---|---|---|
| Instagram posts published | 404 | live account |
| Followers | **81** | live account |
| Following | 233 | live account |
| Avg likes/post (437 tracked) | **0.39** — best ever 6 | `social_posts` |
| Reach recorded | **0 on every post** | `social_posts` |
| Engagement comments posted | 2,063 | `comment-queue.json` |
| Replies recorded from those | **0** | `reply-tracker.json` |
| Newsletter subscribers | **5** (2 genuinely organic) | `subscribers` |
| Business claims | 3 (1 approved) | `business_claims` |
| Site content live | 503 establishments, 320 events | Supabase |

**The pattern:** output is high and rising; outcomes are flat and unmeasured. 404 posts and
2,063 comments have produced 81 followers and 2 organic email signups. The automation is
well-built — it is simply pointed at throughput metrics rather than results.

Everything below follows from one conclusion: **more volume will not move these numbers.**
The constraint is measurement, distribution and conversion — in that order.

---

## 2. Root causes — diagnosed, not guessed

### 2.1 Reach has never been measured (root cause found)

`/api/cron/social-engagement` runs daily and does request `reach,impressions,saved`. I called
the endpoint directly with the production credentials:

```
GET /{media-id}/insights?metric=reach,impressions,saved
→ {"error":{"message":"(#10) Application does not have permission for this action",
             "type":"OAuthException","code":10}}
```

The media endpoint works — that is why likes and comments populate. **Insights are blocked at
the Meta app permission level**, not by the code. The app is missing `instagram_manage_insights`.

Compounding it, the failure is swallowed silently:

```ts
} catch {
  // Insights not available for all posts
}
```

There is no `if (insightData.error)` branch, so an auth failure writes `reach = 0` and looks
like a real measurement. Four months of zeros read as data.

**Fix:** add `instagram_manage_insights` to the Meta app (App Review required for Business
accounts), then log insight errors instead of swallowing them. Also note the two files disagree
on API version — `instagram.ts` defaults to `v25.0`, `social-engagement` to `v21.0`.

### 2.2 Reply tracking stopped on 17 June

`monitor-replies` and `generate-replies` exist in `engagement-bot.py` and are invoked from
`agents/run-engagement.sh` — **but that script is not in `vercel.json` crons.** It only runs when
someone runs it manually, and nobody has since June.

Consequence: 1,688 comments posted since with no outcome data. And of the 375 it did check, it
recorded **0 replies** — a 0% reply rate across 375 comments on active dog accounts is
implausible enough that I would treat the checker itself as suspect before believing the number.

**Fix:** schedule reply monitoring, and validate the checker against a comment we know received
a reply before trusting its output.

### 2.3 The follow lever is switched off by design

2,063 comments against 233 follows. The nightly discovery task explicitly defers following:

> "following requires its own action; list them in the report for the next session to action"

No session ever actions it. Following relevant accounts is the single most direct mechanism for
converting engagement into followers, and it is currently a no-op.

This also explains the feed-first failure. The strategy assumed 1,900+ follows; the account has
**233**. A home feed drawn from 233 accounts was never going to sustain nightly discovery — the
strategy was sound, the input was missing.

### 2.4 There is no funnel from anywhere to the newsletter

Signup surfaces exist only on the homepage, ambassador pages and admin. **503 establishment
pages and 320 event pages have no email capture at all** — that is the highest-intent traffic on
the site receiving no ask.

There is also no Stories capability in `src/lib/instagram.ts` — feed posts only. Instagram feed
captions can't carry links, so Stories with link stickers are the primary Instagram→web path,
and it isn't built.

---

## 3. The plan

### Phase 1 — Make outcomes visible (Week 1, blocking everything else)

Nothing here changes tactics. It makes the next four weeks measurable.

| # | Action | Effort | Owner |
|---|---|---|---|
| 1.1 | **Deploy the pending creative fixes.** 9 files, verified, typechecks clean. Everything downstream assumes this is live. | 10 min | Eric |
| 1.2 | **Add `instagram_manage_insights` to the Meta app** and submit for App Review. This is the long pole — review can take days, so start it first. | 1 hr + review wait | Eric |
| 1.3 | **Stop swallowing insight errors.** Log `insightData.error`, surface in the daily health check, unify API version to one constant. | 1 hr | me |
| 1.4 | **Schedule reply monitoring** as a real cron (`0 8,20 * * *`), and validate the checker against a known-reply comment before trusting it. | 2 hrs | me |
| 1.5 | **Add follower-count snapshotting** — a daily row of followers/following/posts. Without a time series, no growth claim is checkable. | 1 hr | me |
| 1.6 | **Attribute engagement → follows.** When a new follower appears, check whether we commented on them in the prior 14 days. This is the number that tells you if commenting works at all. | 3 hrs | me |

**Exit criteria:** a weekly dashboard showing followers gained, reply rate by city and account
type, reach per post, and comment→follow attribution.

### Phase 2 — Follower growth from businesses and established owners (Weeks 1–3)

Run in parallel; it does not depend on Phase 1 landing, but Phase 1 tells you if it worked.

**2.1 Turn on the follow engine.** The nightly job already identifies follow-worthy venues,
organisers and sponsors — it just writes them to a report. Make it act: follow up to 20 vetted
accounts per day, prioritised by (a) business/venue/organiser type, (b) in one of the 9 markets,
(c) posted within 21 days. Same vetting rules as commenting. Log every follow so 1.6 can
attribute it.

Expected: at typical 20–30% follow-back rates for a relevant niche account, 20 follows/day is
roughly 100–150 new followers/month — versus 81 total today.

**2.2 Lead with the listing, not the comment.** You have 503 establishments listed and only 3
claims. "You're listed on Paw Cities — claim your free listing" is a far stronger opener than a
generic compliment, and it is *true*. It gives the business a reason to follow, to link back, and
to tell their customers. Sequence: follow → comment on a recent post → the bio and listing do the
rest.

**2.3 Fix the comment quality signal.** Current comments read as pleasant but generic
("What a fantastic initiative!"). Once 1.6 is live, A/B two styles — generic-warm vs
specific-local (naming the neighbourhood, the trail, the event date) — and keep whichever
actually earns replies and follows. **Do not guess this; measure it.**

**2.4 Re-check the false dormancy calls.** The profile-endpoint bug reported live accounts as
empty for an unknown period. Every account in `dormant-accounts.json` verified before 2026-08-19
should be re-run through the fixed reader. Likely recovers real targets — and Geneva, still at
1 pending from a 7-account pool, is where it pays off most.

### Phase 3 — Distribution: get the posts seen (Weeks 2–4)

Cadence stays at ~6/day per your call. The work is making each post reach further.

**3.1 Build Stories.** `src/lib/instagram.ts` handles feed posts only. Stories with link stickers
are the main Instagram→site path and you have none. Post each event creative to Stories with a
link sticker to the event page. This is the single highest-leverage missing feature for site
traffic.

**3.2 Collaboration posts.** Instagram's collab feature puts a post on both accounts' grids.
For every event you cover, invite the venue or organiser as a collaborator — you borrow their
audience, they get promotion. This is how a small account reaches a large one.

**3.3 Hashtag and geotag discipline.** Current captions use broad tags (`#DogsOfInstagram`,
~100M posts) where a small account is invisible. Shift to city/neighbourhood tags with
10k–500k posts where you can actually rank, and geotag every post to the venue.

**3.4 Post timing from real data.** Currently fixed at 09/13/17/21 UTC for all nine cities —
meaning Sydney and LA posts fire at absurd local hours. Schedule per-city in local time. Once
reach data exists (1.2), tune from evidence.

### Phase 4 — Site traffic and newsletter (Weeks 2–4)

**4.1 Put email capture on the content that already gets traffic.** 503 establishment pages and
320 event pages have none. Add a contextual, single-field ask:
*"Get dog-friendly [City] events in your inbox"* — city pre-filled from the page.
This is the cheapest fix in the plan and addresses the weakest number in the business.

**4.2 Make the event alert the product.** `subscribers` already has `city_slug`, `event_alerts`
and `weekly_digest` columns — the schema is built and unused. A weekly "what's on for dogs in
your city" email is a genuinely valuable, differentiated reason to subscribe, and you have 320
events to fill it.

**4.3 Close the business claim loop.** 3 claims, 2 rejected, from 503 listings. Worth
understanding why the two were rejected before scaling outreach — if the claim flow has friction,
2.2 will drive traffic into a broken funnel.

---

## 4. Tactical backlog (the earlier challenges)

| Challenge | Solution | Priority |
|---|---|---|
| 9 files uncommitted, nothing deployed | Deploy. Blocks all creative fixes. | **P0** |
| Reach never measured | Meta app permission + error logging (2.1) | **P0** |
| Reply tracking dead since June | Schedule as cron + validate checker (1.4) | **P0** |
| Follow lever unused | Turn on the follow engine (2.1) | **P1** |
| Feed-first strategy failing 3 nights | Root cause is 233 follows, not the feed. Fixed by 2.1; re-evaluate feed-first once following exceeds ~800. Until then, curated sweeps carry discovery — they are working. | **P1** |
| Dormancy false positives | Re-run pre-2026-08-19 calls through the fixed reader (2.4) | **P1** |
| Geneva structurally thin (1 pending, 7 accounts) | New follows in-market; 2.4 may recover some | **P2** |
| Generator dedup gap (browser-path shortcodes) | Exclude posted shortcodes in `engagement-bot.py generate`. I patched the symptom twice; fix the cause. | **P2** |
| City slug split (`losangeles` vs `los-angeles`) | One canonical map, normalise on write. Flagged 08-14, 08-16, still open. | **P2** |
| Legacy `generate-creative` composition cramped | Restyle to match the text-card template | **P3** |
| Curator log `reason` not faithful to image | Cosmetic; logging only. Note in code. | **P3** |

---

## 5. What success looks like

Measure weekly, not daily — the numbers are too small for daily noise to mean anything.

| Metric | Today | 30 days | 90 days |
|---|---|---|---|
| Followers | 81 | 250 | 800 |
| Follower→business/owner ratio | unknown | tracked | >50% in-market |
| Reply rate on comments | unmeasured | measured + >3% | >8% |
| Avg reach per post | unmeasured | measured | rising |
| Newsletter subscribers | 5 | 50 | 300 |
| Business claims | 3 | 15 | 60 |

The 30-day column is deliberately modest on outcomes and heavy on *"measured"* — because for
four of these six you currently cannot tell whether you are winning.

---

## 6. If you only do three things

1. **Deploy, and start the Meta App Review today.** The review wait is the critical path and
   nothing else is knowable without it.
2. **Turn on following.** It is the one lever with a direct, mechanical link to your stated goal
   and it is currently switched off.
3. **Put a newsletter box on establishment and event pages.** Two organic signups from 823
   content pages is not a demand problem — nobody is being asked.

---

## 7. What I would explicitly not do

- **Do not increase comment volume.** 2,063 comments produced 81 followers. Doing more of an
  unmeasured thing is the most expensive way to learn nothing.
- **Do not rebuild the feed-first discovery yet.** It failed because the account follows 233
  accounts. Fix the input first, then re-test.
- **Do not add more content formats** until reach is measurable. You cannot tell what is working.

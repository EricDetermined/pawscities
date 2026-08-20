# Two engagement systems are running in parallel

**2026-08-20.** Found while trying to build an `engagement_log` table to "unify"
engagement data. That table was unnecessary — the data was already in Supabase.
What was actually wrong is more interesting.

---

## The finding

There are **two independent engagement systems**:

| | Local (browser) | Cloud (GitHub Actions) |
|---|---|---|
| Queue | `data/engagement/comment-queue.json` | Supabase `engagement_queue` |
| Runner | `agents/chrome-engagement-runner.py` | `agents/cloud-queue.py` |
| Discovery | Claude via Chrome MCP | `.github/workflows/engagement-discovery.yml`, daily 12:00 UTC, Apify + OpenAI |
| Posts comments? | **Yes — this is the live one** | No, never posts |
| Rows | 2,448 | 2,013 |

The cloud workflow **discovers posts and generates comments every day**, writes them
to Supabase as `pending`, and nothing ever posts them. Posting happens entirely
through the local browser queue.

31 workflow runs to date. Still scheduled.

## What that produced

415 `pending` rows in Supabase, accumulating since 2026-07-22:

| | Count |
|---|---|
| Already **posted** via the local queue | **131** |
| Generated, never seen locally at all | 257 |
| Known locally in some other status | 27 |

## Why it mattered

`cloud-queue.py next` hands out pending comments for posting. It filters on age
(`MAX_PENDING_AGE_DAYS = 7`) but **not** against what the local queue has already
posted. So it would have served comments for accounts we had already commented on —
`@club_diogi` twice, `@streetpawsfestivalofficial` — producing duplicate comments on
the same posts. That's the spam signature Instagram penalises.

Only a handful were inside the 7-day window at any moment, so this was a slow leak
rather than an active fire. But it had no floor: it grows every day the workflow runs.

## What I did

Reconciled Supabase against the local queue as source of truth:

```
before  pending 415  expired   0
after   pending 283  expired 132
```

- 131 rows that were already posted locally → `expired`
- 1 further row inside the servable window that had been touched locally → `expired`
- Verified afterwards: **0 servable pending rows overlap the local queue**

I did **not** touch the 257 orphans. They're stale (mostly >7 days, so `cloud-queue.py`
already filters them) and harmless where they sit. They're evidence of the waste, not a
hazard.

## Decisions for Eric

**1. The daily workflow is spending money for output nobody uses.**

Each run calls Apify (paid scraping) and OpenAI (comment generation). It has run 31
times. A prior commit — *"Cut Apify costs: event-discovery cron daily → Mon+Thu
(engagement discovery now browser-based, no Apify)"* — shows the intent was already to
move off Apify for engagement, but this workflow was left running.

Options:
- **Disable it** (`Actions → Engagement Discovery → ⋯ → Disable workflow`). Stops the
  spend and the accumulation. Browser discovery already covers this.
- **Keep it as a laptop-off fallback** — but then `cloud-queue.py next` must exclude
  anything already in the local queue, or the duplicate risk returns.

Recommendation: **disable**. Browser-based discovery has been producing the real
queue for weeks; this is a parallel path that only creates drift.

**2. If it stays, `cloud-queue.py` needs a dedup guard** against
`comment-queue.json` before serving a batch. Reconciling by hand is not a fix.

---

## What this changes about the architecture plan

The earlier plan (`GROWTH-PLAN-V2-INTEGRATED.md` §3) said engagement data lived on a
"local-JSON island" invisible to Supabase, and proposed an `engagement_log` table to
bridge it. **That was wrong.** `engagement_queue` already exists and mirrors the local
schema closely.

The real problem is not a missing table — it's **two writers and no reconciliation**.
Adding a third store would have made it worse. Corrected in the plan.

Still genuinely missing from Supabase: **reply data**. `engagement_queue` has no reply
columns, so the 23.5% reply rate and 74 tracked replies live only in
`reply-tracker.json`. That's the one piece worth syncing — and it's additive, not a
new parallel system.

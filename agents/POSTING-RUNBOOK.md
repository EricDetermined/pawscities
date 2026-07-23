# Daily Posting Session Runbook (laptop-on, Claude via Chrome)

The daily engagement session runs in the user's Chrome, logged in as
@thepawcities. Discovery is laptop-off (GitHub Actions -> Supabase
`engagement_queue`); this runbook covers the interactive session only.

## Order of operations

### 1. DM inbox triage (~2 min, FIRST every session)

Open `instagram.com/direct/inbox` and review unread threads:

| Sender type | How to detect | Action |
|---|---|---|
| **Ambassador** | Handle matches `ambassador_applications.instagram_handle` (query Supabase; e.g. @zoebee = Zoe/Atlanta) | PRIORITY: summarize to Eric immediately in-session; draft reply for his approval |
| **Business / venue** | Bio or message mentions their establishment, partnership, listing, event | Log to `data/venue-leads.jsonl`; draft reply for approval |
| **Community / fan** | Everything else | Draft short friendly reply for approval; never auto-send |
| **Spam / bot** | Generic promo, crypto, follower-selling | Ignore; report only |

Rules:
- READ ONLY by default — replies are drafted in chat and sent only after
  Eric approves (each send is an explicit approval).
- Never open message requests from obvious spam.
- Ambassador DMs are never left unanswered across two consecutive sessions.

### 2. Post the daily 25 (cloud queue + Haiku vets)

1. `python3 agents/cloud-queue.py next 4` — pulls city-balanced,
   influencer-prioritized batch (blocklist swept, 3-day account-recency
   dedupe, daily cap 25).
2. Per item: Haiku subagent vets the post on-page (read-only: location tag,
   city hashtags, language, already-commented check). Fable judges
   borderline cases.
3. Post if verified: like -> comment (adapt text if it doesn't fit the
   actual post) -> verify live -> `mark-posted`. Otherwise `mark-failed`
   with a descriptive reason (all reasons feed blocklist/gate tuning).
4. Human pacing: 90-150s between comments, 5-12 min break every 4 posts.
5. Venue/organizer accounts worth partnering with -> `data/venue-leads.jsonl`.

### 3. Wrap-up

- Report tally (posted/skipped, by city) + queue stats + any leads.
- Flag repeat off-target accounts for `data/engagement-blocklist.json`.

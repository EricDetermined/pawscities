# Measurement Runbook — Phase 1

Added 2026-08-19. Companion to `POSTING-RUNBOOK.md`.

## Why

Before this, nothing measured whether engagement worked. 2,063 comments and 404 posts had
produced 81 followers, and:

- `reply-tracker.json` showed **0 replies across 375 comments** and hadn't updated since 17 June.
  It required a `comment_pk` that browser-posted comments never carried, so it was checking
  nothing and reporting success.
- There was no follower time series at all.
- Nothing linked "we commented on X" to "X followed us".

First real sweep with the fixed checker found a **20% reply rate** (3 of 15). The 0% was an
artefact, not a result.

## Daily — add to the nightly discovery session

Run **after** discovery, before writing the report.

### 1. Reply sweep

```bash
cd <repo> && python3 agents/growth-tracker.py replies-todo --days 14 --max 30
```

Take the emitted shortcodes and run this in the browser (Chrome MCP, logged in as
@thepawcities). Note the shortcode → media_id conversion — the `/media/{shortcode}/info/`
endpoint rejects shortcodes:

```js
const A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const toMediaId = sc => { let n=0n; for (const c of sc) n = n*64n + BigInt(A.indexOf(c)); return n.toString(); };

const H={'x-ig-app-id':'936619743392459'}, ME='thepawcities';
async function check(codes){
  const out=[];
  for (const code of codes){
    const mid = toMediaId(code);
    const c = await fetch(`/api/v1/media/${mid}/comments/?can_support_threading=true`,{headers:H}).then(r=>r.json());
    const ours = (c.comments||[]).find(x => ((x.user||{}).username||'').toLowerCase() === ME);
    if (!ours) { out.push({shortcode:code, media_pk:mid, replies:[], note:'our_comment_not_found'}); continue; }
    let replies = [];
    if (ours.child_comment_count > 0) {
      const k = await fetch(`/api/v1/media/${mid}/comments/${ours.pk}/child_comments/`,{headers:H}).then(r=>r.json());
      replies = (k.child_comments||[]).map(x => ({from:x.user.username, text:x.text, created_at:x.created_at}));
    }
    out.push({shortcode:code, our_comment_pk:String(ours.pk), media_pk:mid, replies,
      our_comment_likes: ours.comment_like_count || 0});
  }
  return out;
}
```

Run in batches of ~15 — larger batches exceed the 45s CDP timeout. Then:

```bash
python3 agents/growth-tracker.py record-replies /tmp/replies.json
```

**Engagement = replies + likes-on-our-comment (2026-08-29).** The tracker now
computes `engagement_rate_v2` and a `by_city` breakdown counting a comment as
engaged when it got a reply OR the target liked it. Judge markets on the
engagement rate, not the reply rate — Tokyo in particular engages via likes
and follow-backs rather than comment replies, and looked falsely broken under
replies-only measurement. Follow-backs are attributed separately by
`record-followers` (nightly follower diff).

```bash
# (kept for reference)
```

### 2. Follower sweep

```js
const uid = (document.cookie.match(/ds_user_id=(\d+)/)||[])[1];
let out=[], max='';
for (let i=0;i<10;i++){
  const j = await fetch(`/api/v1/friendships/${uid}/followers/?count=50${max?'&max_id='+encodeURIComponent(max):''}`,{headers:H}).then(r=>r.json());
  (j.users||[]).forEach(x => out.push({username:x.username, full_name:x.full_name||'', is_verified:!!x.is_verified}));
  if (!j.next_max_id) break; max = j.next_max_id;
}
```

```bash
python3 agents/growth-tracker.py record-followers /tmp/followers.json
```

This diffs against yesterday, and for each new follower checks whether we commented on them in
the prior 14 days — that is the comment→follow attribution number.

### 3. Report

```bash
python3 agents/growth-tracker.py report
```

Include the output in the nightly report. Track over time: reply rate, followers gained,
% attributed to a comment, % that are businesses.

## Automatic (no action needed)

| Job | Schedule | What |
|---|---|---|
| `/api/cron/account-snapshot` | 23:00 UTC daily | followers/following/posts + deltas → `account_snapshots` |
| `/api/cron/social-engagement` | 10:00 UTC daily | likes/comments; now logs the insights permission failure instead of writing fake zeros |

## Known limits — do not misread the data

- **Reach and saves are still unavailable.** The Meta app lacks `instagram_manage_insights`
  (`OAuthException #10`). They are now written as `null`, not `0`, so they cannot be mistaken
  for measured zeros. Fixing this needs App Review — plan item 1.2.
- **375 legacy reply rows are excluded from the reply rate.** They were checked by the broken
  pre-2026-08-19 checker and their zeros mean "not checked", not "no reply". `report` prints
  the v2-only rate and states how many legacy rows it ignored.
- **Attribution is correlational.** A follower who was commented on within 14 days is
  *attributed* to that comment; it is not proof of causation. Useful as a trend, not a guarantee.
- **`account_snapshots` / `follower_events` require migration 021.** Until it is applied in the
  Supabase SQL editor, the cron returns `snapshot_write_failed` with a hint, and the local
  `data/engagement/follower-snapshots.json` remains the source of truth.

#!/usr/bin/env python3
"""
Push local engagement state up to Supabase.

WHY
---
Everything about what we actually posted and what came back lives in two JSON
files on one laptop:

    data/engagement/comment-queue.json   2,073 posted comments
    data/engagement/reply-tracker.json     682 reply checks, 72 replies

Supabase's engagement_queue only ever saw the cloud-discovery half. Of the 307
verified reply records, only 68 have a matching row there — so 78% of our
sharpest targeting signal was invisible to anything running off the database.

This makes Supabase a complete mirror, so the nightly brief can run on a cron
without the laptop being awake, and so a disk failure stops being a data loss.

DIRECTION IS ONE-WAY: local -> Supabase. The local files stay the source of
truth for posting; this never writes back down, never posts, never follows.

Usage:
    python3 agents/sync-engagement.py --dry-run   # show what would change
    python3 agents/sync-engagement.py             # apply
    python3 agents/sync-engagement.py --verify    # compare both sides
"""

import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENG = ROOT / "data" / "engagement"
BATCH = 500

# Statuses worth mirroring. 'pending' is deliberately excluded: it is local
# working state that changes minute to minute, and copying it up would recreate
# the phantom-pending drift that DUAL-SYSTEM-FINDING documented.
SYNC_STATUSES = {"posted", "failed", "expired", "blocked_safety",
                 "blocked_account", "skipped_vetting"}

# Columns that exist on engagement_queue. Anything else in the local record is
# local-only bookkeeping (e.g. posted_via) and must not be sent — PostgREST
# rejects the whole batch on an unknown column.
QUEUE_COLS = {"id", "post_id", "post_shortcode", "post_url", "target_username",
              "post_likes", "city", "comment_text", "comment_category",
              "comment_language", "comment_hash", "status", "created_at",
              "posted_at", "error", "source"}
REPLY_COLS = {"reply_count", "replied", "reply_checked_at", "reply_checker",
              "replies", "followed_back"}


def env():
    for name in (".env.local", ".env.instagram"):
        p = ROOT / name
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Supabase credentials not found in .env.local")
    return url, key


def req(url, key, path, method="GET", body=None, extra_headers=None):
    headers = {"apikey": key, "Authorization": f"Bearer {key}",
               "Content-Type": "application/json"}
    headers.update(extra_headers or {})
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{url}/rest/v1/{path}", data=data,
                               headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip() else []


def fetch_all(url, key, path_base):
    """Page through a table; PostgREST caps a single response at 1000 rows."""
    out, off = [], 0
    while True:
        sep = "&" if "?" in path_base else "?"
        batch = req(url, key, f"{path_base}{sep}limit=1000&offset={off}")
        out += batch
        if len(batch) < 1000:
            return out
        off += 1000
        if off > 20000:
            return out


def build_records(sb_shortcode_to_id):
    """
    Merge the local queue with reply outcomes into engagement_queue rows.

    JOIN KEY IS post_shortcode, NOT post_id.
    292 local rows carry a synthetic post_id the browser runner invented
    ('bt-DboIzrNI9d6', 'browser-1786028898-4') because it posts from a page URL
    and never sees Instagram's numeric media_pk. Joining on post_id silently
    dropped 155 of 307 verified reply records — over half our best signal.
    Shortcodes match 682/682.

    We also NORMALISE the id, because post_id carries the table's unique index:
      1. the reply-tracker resolved the real media_pk -> use it (repairs 155)
      2. Supabase already has this shortcode under a real id -> reuse that id
         (without this, 7 rows insert as duplicates of posts already recorded,
         which is the double-comment hazard from DUAL-SYSTEM-FINDING)
      3. otherwise keep the synthetic id
    """
    queue = json.loads((ENG / "comment-queue.json").read_text())["items"]
    tracker = json.loads((ENG / "reply-tracker.json").read_text())
    replies = {r["post_shortcode"]: r
               for r in tracker.get("comments", []) if r.get("post_shortcode")}
    real_pk = {r["post_shortcode"]: r["media_pk"]
               for r in tracker.get("comments", [])
               if r.get("post_shortcode") and str(r.get("media_pk", "")).isdigit()}
    # followed_back is tracked separately, keyed by username.
    followed = set(tracker.get("followed_back") or [])

    records, skipped, repaired = [], Counter(), Counter()
    for item in queue:
        if item.get("status") not in SYNC_STATUSES:
            skipped[item.get("status")] += 1
            continue
        if not item.get("post_id"):
            skipped["no post_id"] += 1
            continue

        rec = {k: v for k, v in item.items() if k in QUEUE_COLS}
        rec.setdefault("source", "browser-local")

        sc = item.get("post_shortcode")
        if not str(rec["post_id"]).isdigit() and sc:
            if sc in real_pk:
                rec["post_id"] = real_pk[sc]
                repaired["from reply-tracker"] += 1
            elif sc in sb_shortcode_to_id and str(sb_shortcode_to_id[sc]).isdigit():
                rec["post_id"] = sb_shortcode_to_id[sc]
                repaired["from existing Supabase row"] += 1
        # comment_text is NOT NULL on the table.
        if not rec.get("comment_text"):
            skipped["no comment_text"] += 1
            continue

        r = replies.get(sc)
        if r:
            reply_list = r.get("replies") or []
            checker = r.get("checker")
            rec["reply_checked_at"] = r.get("reply_checked_at")
            rec["reply_checker"] = checker
            rec["replies"] = reply_list or None
            rec["reply_count"] = len(reply_list)
            # Only a verified check may assert "no reply". Legacy detection
            # filtered on comment_pk, which browser-posted comments never had,
            # so its zeros are false negatives — store NULL, not False, or the
            # rate silently collapses toward 0% the way it did before.
            rec["replied"] = bool(reply_list) if (reply_list or checker == "browser_v2") else None
        if item.get("target_username") in followed:
            rec["followed_back"] = True
        records.append(rec)

    # Two local rows can now normalise onto the same post_id (the same post
    # commented twice). PostgREST rejects a batch containing duplicate conflict
    # keys, so keep the most recently posted one.
    deduped = {}
    for r in sorted(records, key=lambda x: x.get("posted_at") or ""):
        deduped[r["post_id"]] = r
    if len(deduped) < len(records):
        skipped["duplicate post_id collapsed"] = len(records) - len(deduped)
    out = list(deduped.values())

    # PostgREST requires EVERY object in a bulk request to carry an identical
    # key set (PGRST102 "All object keys must match") — it builds one INSERT
    # from the first object's shape. Only ~300 of 2,400 rows have reply data,
    # so pad every record to the full column set with None.
    all_keys = set().union(*(r.keys() for r in out)) if out else set()
    for r in out:
        for k in all_keys:
            r.setdefault(k, None)
    return out, skipped, repaired


def main():
    dry = "--dry-run" in sys.argv
    verify_only = "--verify" in sys.argv
    url, key = env()

    existing = fetch_all(url, key, "engagement_queue?select=post_id,post_shortcode")
    sb_map = {r["post_shortcode"]: r["post_id"] for r in existing
              if r.get("post_shortcode")}
    records, skipped, repaired = build_records(sb_map)
    have = {r["post_id"] for r in existing}
    new = [r for r in records if r["post_id"] not in have]
    upd = [r for r in records if r["post_id"] in have]
    with_reply = [r for r in records if r.get("reply_checker")]
    verified = [r for r in with_reply if r["reply_checker"] == "browser_v2"]

    print(f"local rows eligible : {len(records)}")
    print(f"  new to Supabase   : {len(new)}")
    print(f"  already present   : {len(upd)} (will be refreshed)")
    print(f"  carrying replies  : {len(with_reply)} ({len(verified)} browser_v2-verified)")
    if repaired:
        print(f"  synthetic ids fixed: {dict(repaired)}")
    if skipped:
        print(f"  skipped           : {dict(skipped)}")

    if verify_only:
        rates = req(url, key, "engagement_reply_rates?select=*")
        print("\nSupabase engagement_reply_rates view:")
        for row in rates:
            print(f"  {row['city']:<15} {row['reply_rate_pct']:>5}%  "
                  f"({row['replied']}/{row['checked']})")
        return 0

    if dry:
        print("\n--dry-run: nothing written.")
        if new:
            s = new[0]
            print(f"sample new row: {s['post_shortcode']} @{s.get('target_username')} "
                  f"[{s.get('city')}] replied={s.get('replied')}")
        return 0

    # Upsert on post_id — the table's unique index. merge-duplicates means an
    # existing row is updated in place rather than erroring.
    sent = 0
    for i in range(0, len(records), BATCH):
        chunk = records[i:i + BATCH]
        try:
            req(url, key, "engagement_queue?on_conflict=post_id", method="POST",
                body=chunk,
                extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
            sent += len(chunk)
            print(f"  synced {sent}/{len(records)}")
        except urllib.error.HTTPError as e:
            print(f"\nFAILED at batch {i // BATCH + 1}: {e.code}")
            print(e.read().decode()[:400])
            print("Has migration 022_engagement_replies.sql been applied?")
            return 1

    rates = req(url, key, "engagement_reply_rates?select=*")
    print(f"\nDone. Reply rates now queryable in the cloud:")
    for row in rates:
        print(f"  {row['city']:<15} {row['reply_rate_pct']:>5}%  "
              f"({row['replied']}/{row['checked']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

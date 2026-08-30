#!/usr/bin/env python3
"""
PawCities Growth Tracker — Phase 1 measurement.

WHY THIS EXISTS
---------------
As of the 2026-08-19 audit, 404 posts and 2,063 engagement comments had produced
81 followers and none of it was measured:

  * `reply-tracker.json` recorded 0 replies across 375 checked comments and had
    not updated since 17 June. Root cause: `engagement-bot.py monitor-replies`
    only checks comments that carry a `comment_pk`, and once posting moved to
    the browser (`posted_via: chrome_mcp`) that field was written as "". By
    August, 0 of 285 comments had a pk, so the monitor had nothing to check and
    exited reporting success.
  * There was no follower time series, so no growth claim was checkable.
  * Nothing connected "we commented on X" to "X followed us".

This script fixes all three WITHOUT needing comment_pk: our comment is located
on each post by username, and replies are read as child comments.

DESIGN
------
Like `chrome-engagement-runner.py`, this manages state only. Instagram reads are
performed by Claude through Chrome MCP (the logged-in session) and piped in as
JSON, because the follower list and comment threads are not available through
the Graph API token the app holds.

COMMANDS
--------
  replies-todo [--days 14] [--max 40]   Emit posts to check for replies
  record-replies <file.json|->          Ingest reply results
  record-followers <file.json|->        Ingest follower list, diff + attribute
  report                                Print the measurement summary
"""

import json
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENG = ROOT / "data" / "engagement"
QUEUE_FILE = ENG / "comment-queue.json"
HISTORY_FILE = ENG / "comment-history.json"
TRACKER_FILE = ENG / "reply-tracker.json"
FOLLOWERS_FILE = ENG / "follower-snapshots.json"

OUR_USERNAME = os.environ.get("IG_USERNAME", "thepawcities").lower()
ATTRIBUTION_WINDOW_DAYS = 14


# ─── IO helpers ───────────────────────────────────────────────────────────────

def _load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    tmp.replace(path)


def _parse_dt(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _read_payload(arg):
    """Accept a file path or '-' for stdin."""
    raw = sys.stdin.read() if arg == "-" else Path(arg).read_text()
    return json.loads(raw)


# ─── replies-todo ─────────────────────────────────────────────────────────────

def cmd_replies_todo(days=ATTRIBUTION_WINDOW_DAYS, max_items=40):
    """
    Emit the posts worth checking for replies: recently commented, oldest-checked
    first. Deliberately does NOT require comment_pk — that requirement is what
    silently disabled reply tracking in the first place.
    """
    queue = _load(QUEUE_FILE, {"items": []})
    tracker = _load(TRACKER_FILE, {"comments": [], "followed_back": [], "stats": {}})

    last_checked = {}
    for c in tracker.get("comments", []):
        code = c.get("post_shortcode")
        if code:
            last_checked[code] = c.get("reply_checked_at") or ""

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    seen, todo = set(), []
    for item in queue.get("items", []):
        if item.get("status") != "posted":
            continue
        posted = _parse_dt(item.get("posted_at"))
        if not posted or posted < cutoff:
            continue
        code = item.get("post_shortcode")
        if not code or code in seen:
            continue
        seen.add(code)
        todo.append({
            "shortcode": code,
            "target_username": item.get("target_username") or item.get("account"),
            "city": item.get("city"),
            "posted_at": item.get("posted_at"),
            "our_comment": (item.get("comment_text") or "")[:120],
            "last_checked": last_checked.get(code, ""),
        })

    todo.sort(key=lambda t: (t["last_checked"] or "", t["posted_at"]))
    print(json.dumps({"count": len(todo[:max_items]), "trackable": len(todo),
                      "posts": todo[:max_items]}, indent=1))


# ─── record-replies ───────────────────────────────────────────────────────────

def cmd_record_replies(payload_arg):
    """
    Ingest reply-check results.

    Expected payload: {"results": [
      {"shortcode": "...", "our_comment_pk": "...", "media_pk": "...",
       "our_comment_text": "...", "target_username": "...", "city": "...",
       "replies": [{"from": "...", "text": "...", "created_at": 1234567890}]}
    ]}
    """
    payload = _read_payload(payload_arg)
    results = payload.get("results", payload if isinstance(payload, list) else [])

    tracker = _load(TRACKER_FILE, {"comments": [], "followed_back": [], "stats": {}})
    history = _load(HISTORY_FILE, [])
    by_code = {c.get("post_shortcode"): c for c in tracker["comments"] if c.get("post_shortcode")}
    now = datetime.now(timezone.utc).isoformat()

    new_replies = 0
    checked = 0
    pk_backfilled = 0

    for r in results:
        code = r.get("shortcode")
        if not code:
            continue
        checked += 1
        replies = r.get("replies") or []

        entry = by_code.get(code)
        if entry is None:
            entry = {
                "comment_pk": r.get("our_comment_pk", ""),
                "media_pk": r.get("media_pk", ""),
                "post_url": f"https://www.instagram.com/p/{code}/",
                "post_shortcode": code,
                "target_username": r.get("target_username", ""),
                "our_comment": r.get("our_comment_text", ""),
                "city": r.get("city"),
                "posted_at": r.get("posted_at"),
                "replies": [],
                "reply_checked_at": None,
            }
            tracker["comments"].append(entry)
            by_code[code] = entry

        # Backfill the pk we could not capture at post time via the browser path.
        if r.get("our_comment_pk") and not entry.get("comment_pk"):
            entry["comment_pk"] = r["our_comment_pk"]
            entry["media_pk"] = r.get("media_pk", "")
            pk_backfilled += 1

        known = {(x.get("from"), x.get("text")) for x in entry.get("replies", [])}
        for rep in replies:
            key = (rep.get("from"), rep.get("text"))
            if key in known:
                continue
            entry.setdefault("replies", []).append({
                "from": rep.get("from"),
                "text": rep.get("text"),
                "created_at": rep.get("created_at"),
                "found_at": now,
            })
            new_replies += 1
        # Likes on OUR comment (2026-08-29): a like from the target account is a
        # real engagement signal even with no reply — Tokyo especially engages
        # via likes/follows rather than comment replies, so counting replies
        # alone made that market look broken when it is just quieter.
        if r.get("our_comment_likes") is not None:
            entry["our_comment_likes"] = int(r.get("our_comment_likes") or 0)
        entry["reply_checked_at"] = now
        # Mark which checker verified this. The pre-2026-08-19 checker required a
        # comment_pk that browser-posted comments never had, so its 375 "checked,
        # 0 replies" rows are not evidence of a 0% reply rate — they are evidence
        # it checked nothing. Rates are computed over v2 rows only.
        entry["checker"] = "browser_v2"

    # Mirror pk backfill into comment-history so engagement-bot's own monitor works again.
    hist_by_code = {}
    for h in history if isinstance(history, list) else []:
        if h.get("post_shortcode"):
            hist_by_code.setdefault(h["post_shortcode"], []).append(h)
    for r in results:
        code, pk = r.get("shortcode"), r.get("our_comment_pk")
        if not code or not pk:
            continue
        for h in hist_by_code.get(code, []):
            if not h.get("comment_pk"):
                h["comment_pk"] = pk
                h["media_pk"] = r.get("media_pk", "")

    total_replies = sum(len(c.get("replies") or []) for c in tracker["comments"])
    v2 = [c for c in tracker["comments"] if c.get("checker") == "browser_v2"]
    v2_replied = [c for c in v2 if c.get("replies")]
    # ENGAGED = replied OR our comment was liked (2026-08-29). Reply rate alone
    # under-measures quiet-reply markets (Tokyo); likes on our comment count.
    v2_liked = [c for c in v2 if (c.get("our_comment_likes") or 0) > 0]
    v2_engaged = [c for c in v2 if c.get("replies") or (c.get("our_comment_likes") or 0) > 0]
    by_city = {}
    for c in v2:
        city = c.get("city") or "?"
        b = by_city.setdefault(city, {"checked": 0, "replied": 0, "liked": 0, "engaged": 0})
        b["checked"] += 1
        if c.get("replies"): b["replied"] += 1
        if (c.get("our_comment_likes") or 0) > 0: b["liked"] += 1
        if c.get("replies") or (c.get("our_comment_likes") or 0) > 0: b["engaged"] += 1
    tracker["stats"] = {
        "total_replies": total_replies,
        "checked_v2": len(v2),
        "replied_v2": len(v2_replied),
        "liked_v2": len(v2_liked),
        "engaged_v2": len(v2_engaged),
        "reply_rate_v2": round(100.0 * len(v2_replied) / max(len(v2), 1), 2),
        "engagement_rate_v2": round(100.0 * len(v2_engaged) / max(len(v2), 1), 2),
        "by_city": by_city,
        "legacy_checked_unreliable": sum(
            1 for c in tracker["comments"]
            if c.get("reply_checked_at") and c.get("checker") != "browser_v2"
        ),
        "last_run": now,
    }

    _save(TRACKER_FILE, tracker)
    if isinstance(history, list):
        _save(HISTORY_FILE, history)

    print(json.dumps({
        "checked": checked,
        "new_replies": new_replies,
        "comment_pk_backfilled": pk_backfilled,
        "total_replies_tracked": total_replies,
        "reply_rate_pct_v2": tracker["stats"]["reply_rate_v2"],
    }, indent=1))


# ─── record-followers ─────────────────────────────────────────────────────────

def _classify(user):
    """Rough audience classification — are we winning businesses and real owners?"""
    name = f"{user.get('username','')} {user.get('full_name','')}".lower()
    business_words = (
        "pet", "dog", "vet", "groom", "cafe", "café", "bar", "pub", "hotel", "shop",
        "store", "bakery", "brewery", "rescue", "shelter", "club", "market", "studio",
        "salon", "daycare", "boarding", "training", "co.", "ltd", "inc", "official",
    )
    if user.get("is_verified"):
        return "verified"
    if any(w in name for w in business_words):
        return "business"
    return "individual"


def cmd_record_followers(payload_arg):
    """
    Ingest the current follower list, diff against the previous snapshot, and
    attribute each new follower to prior engagement.

    Expected payload: {"followers": [{"username","full_name","verified","private","pk"}]}
    """
    payload = _read_payload(payload_arg)
    followers = payload.get("followers", payload if isinstance(payload, list) else [])
    if not followers:
        print(json.dumps({"error": "no followers in payload"}))
        return

    store = _load(FOLLOWERS_FILE, {"snapshots": [], "events": []})
    today = datetime.now(timezone.utc).date().isoformat()

    current = {f["username"].lower(): f for f in followers if f.get("username")}
    prev_snap = store["snapshots"][-1] if store["snapshots"] else None
    previous = set(prev_snap["usernames"]) if prev_snap else set()

    gained = sorted(set(current) - previous) if prev_snap else []
    lost = sorted(previous - set(current)) if prev_snap else []

    # Build engagement index: who did we comment on, and when
    queue = _load(QUEUE_FILE, {"items": []})
    engaged = {}
    for item in queue.get("items", []):
        if item.get("status") != "posted":
            continue
        u = (item.get("target_username") or item.get("account") or "").lower()
        dt = _parse_dt(item.get("posted_at"))
        if not u or not dt:
            continue
        if u not in engaged or dt > engaged[u]["at"]:
            engaged[u] = {"at": dt, "city": item.get("city"), "shortcode": item.get("post_shortcode")}

    now = datetime.now(timezone.utc)
    events = []
    for u in gained:
        e = engaged.get(u)
        attributed, days, city, code = "none", None, None, None
        if e:
            days = (now - e["at"]).days
            city, code = e["city"], e["shortcode"]
            attributed = "comment" if days <= ATTRIBUTION_WINDOW_DAYS else "none"
        events.append({
            "username": u,
            "event_type": "gained",
            "detected_on": today,
            "attributed_to": attributed,
            "attributed_city": city,
            "days_since_engagement": days,
            "last_comment_shortcode": code,
            "account_type": _classify(current[u]),
            "is_business": _classify(current[u]) == "business",
        })
    for u in lost:
        events.append({"username": u, "event_type": "lost", "detected_on": today,
                       "attributed_to": "unknown", "account_type": None})

    store["snapshots"].append({
        "captured_on": today,
        "count": len(current),
        "usernames": sorted(current),
        "by_type": dict(Counter(_classify(f) for f in current.values())),
    })
    store["snapshots"] = store["snapshots"][-120:]  # keep ~4 months
    store["events"].extend(events)
    _save(FOLLOWERS_FILE, store)

    attributed = sum(1 for e in events if e.get("attributed_to") == "comment")
    print(json.dumps({
        "followers_now": len(current),
        "baseline": prev_snap is None,
        "gained": len(gained),
        "lost": len(lost),
        "gained_attributed_to_comment": attributed,
        "by_type": store["snapshots"][-1]["by_type"],
        "new_followers": gained[:25],
    }, indent=1))


# ─── report ───────────────────────────────────────────────────────────────────

def cmd_report():
    tracker = _load(TRACKER_FILE, {"comments": [], "stats": {}})
    store = _load(FOLLOWERS_FILE, {"snapshots": [], "events": []})
    comments = tracker.get("comments", [])
    checked = [c for c in comments if c.get("checker") == "browser_v2"]
    replied = [c for c in checked if c.get("replies")]
    legacy = sum(1 for c in comments
                 if c.get("reply_checked_at") and c.get("checker") != "browser_v2")

    print("\n🐾 PawCities — Growth Measurement\n")
    print(f"  Comments checked for replies : {len(checked)}")
    print(f"  Comments that got a reply    : {len(replied)}"
          f"  ({100*len(replied)/max(len(checked),1):.1f}%)")

    if replied:
        by_city = Counter(c.get("city") for c in replied)
        print(f"  Replies by city              : {dict(by_city)}")
    if legacy:
        print(f"  (excluded: {legacy} legacy rows checked by the broken pre-2026-08-19 checker)")

    snaps = store.get("snapshots", [])
    if snaps:
        latest = snaps[-1]
        print(f"\n  Followers                    : {latest['count']}  {latest.get('by_type', {})}")
        if len(snaps) > 1:
            print(f"  Change since {snaps[-2]['captured_on']}    : "
                  f"{latest['count'] - snaps[-2]['count']:+d}")
        gained = [e for e in store.get("events", []) if e.get("event_type") == "gained"]
        attr = [e for e in gained if e.get("attributed_to") == "comment"]
        if gained:
            print(f"  Followers gained (tracked)   : {len(gained)}")
            print(f"  ...attributed to a comment   : {len(attr)}"
                  f"  ({100*len(attr)/len(gained):.0f}%)")
            print(f"  ...that are businesses       : {sum(1 for e in gained if e.get('is_business'))}")
    else:
        print("\n  No follower snapshot yet — run record-followers to set a baseline.")
    print()


# ─── entry point ──────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    args = sys.argv[2:]
    if cmd == "replies-todo":
        days = int(args[args.index("--days") + 1]) if "--days" in args else ATTRIBUTION_WINDOW_DAYS
        mx = int(args[args.index("--max") + 1]) if "--max" in args else 40
        cmd_replies_todo(days, mx)
    elif cmd == "record-replies":
        cmd_record_replies(args[0] if args else "-")
    elif cmd == "record-followers":
        cmd_record_followers(args[0] if args else "-")
    elif cmd == "report":
        cmd_report()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    main()

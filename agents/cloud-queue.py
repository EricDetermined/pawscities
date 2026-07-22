#!/usr/bin/env python3
"""
Cloud engagement queue manager — Supabase-backed twin of chrome-engagement-runner.py.

Used from cloud posting sessions (Claude drives the user's Chrome; this script
only manages the queue). Discovery fills engagement_queue via GitHub Actions
(see .github/workflows/engagement-discovery.yml); this script selects vetted,
city-balanced batches and records outcomes.

Env (or .env.local in repo root):
  SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Commands:
  next [N]              JSON batch of next N postable comments (default 4)
  mark-posted <id>      Mark a comment posted (sets posted_at)
  mark-failed <id> <reason>
  stats                 Queue + today counts
"""

import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

DAILY_CAP = 25
MAX_PENDING_AGE_DAYS = 7
CITY_SLUGS = [
    "new-york-city", "los-angeles", "london", "paris",
    "tokyo", "barcelona", "geneva", "sydney", "atlanta",
]


def _load_env_file():
    env_path = BASE_DIR / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _env():
    _load_env_file()
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print(json.dumps({"error": "missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"}))
        sys.exit(1)
    return url, key


def _call(method, path, payload=None, prefer=None):
    url, key = _env()
    req = urllib.request.Request(
        f"{url}/rest/v1{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            **({"Prefer": prefer} if prefer else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            return json.loads(body) if body else []
    except urllib.error.HTTPError as e:
        print(json.dumps({"error": f"{e.code} {e.read().decode()[:300]}"}))
        sys.exit(1)


def load_blocklist():
    path = DATA_DIR / "engagement-blocklist.json"
    if path.exists():
        try:
            return {k.lower().lstrip("@") for k in json.loads(path.read_text()) if not k.startswith("_")}
        except Exception:
            return set()
    return set()


def load_influencers():
    path = DATA_DIR / "influencer-targets.json"
    if path.exists():
        try:
            return {k.lower().lstrip("@") for k in json.loads(path.read_text())}
        except Exception:
            return set()
    return set()


def sweep():
    """Expire stale pending items and quarantine blocklisted targets."""
    # 'Z' suffix, not '+00:00' — a literal '+' in a query string decodes to a space
    cutoff = (datetime.now(timezone.utc) - timedelta(days=MAX_PENDING_AGE_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    expired = _call(
        "PATCH",
        f"/engagement_queue?status=eq.pending&created_at=lt.{cutoff}",
        payload={"status": "expired", "error": f"auto-expired: older than {MAX_PENDING_AGE_DAYS} days"},
        prefer="return=representation",
    )
    blocked_total = 0
    for handle in load_blocklist():
        rows = _call(
            "PATCH",
            f"/engagement_queue?status=eq.pending&target_username=ilike.{handle}",
            payload={"status": "blocked_account", "error": "account on engagement-blocklist.json"},
            prefer="return=representation",
        )
        blocked_total += len(rows or [])
    return len(expired or []), blocked_total


def today_posted():
    today = datetime.now(timezone.utc).date().isoformat()
    rows = _call("GET", f"/engagement_queue?select=id,city&status=eq.posted&posted_at=gte.{today}T00:00:00Z")
    return rows or []


def cmd_next(limit):
    posted = today_posted()
    remaining = max(0, DAILY_CAP - len(posted))
    if remaining <= 0:
        print(json.dumps({"status": "daily_cap_reached", "posted_today": len(posted), "cap": DAILY_CAP}))
        return
    expired, blocked = sweep()

    pending = _call("GET", "/engagement_queue?select=*&status=eq.pending&order=created_at.desc&limit=500") or []
    if not pending:
        print(json.dumps({"status": "queue_empty", "posted_today": len(posted)}))
        return

    influencers = load_influencers()
    posted_today_accounts = set()
    if posted:
        ids = ",".join(f'"{r["id"]}"' for r in posted)
        rows = _call("GET", f"/engagement_queue?select=target_username&status=eq.posted&id=in.({ids})") or []
        posted_today_accounts = {(r.get("target_username") or "").lower() for r in rows}

    # One comment per account per day
    pending = [p for p in pending if (p.get("target_username") or "").lower() not in posted_today_accounts]

    # City balance: fewest-posted-today cities first; influencer targets first within city
    city_counts = {}
    for r in posted:
        city_counts[r.get("city") or "?"] = city_counts.get(r.get("city") or "?", 0) + 1
    pending.sort(key=lambda x: (
        city_counts.get(x.get("city") or "?", 0),
        0 if (x.get("target_username") or "").lower() in influencers else 1,
        -(x.get("post_likes") or 0),
    ))

    # Round-robin across cities
    batch, seen_accounts, per_city = [], set(), {}
    n = min(limit, remaining)
    for item in pending:
        acct = (item.get("target_username") or "").lower()
        city = item.get("city") or "?"
        if acct in seen_accounts:
            continue
        if per_city.get(city, 0) >= max(1, n // 3):
            continue
        batch.append(item)
        seen_accounts.add(acct)
        per_city[city] = per_city.get(city, 0) + 1
        if len(batch) >= n:
            break
    if len(batch) < n:  # relax per-city cap if underfilled
        for item in pending:
            acct = (item.get("target_username") or "").lower()
            if acct in seen_accounts or item in batch:
                continue
            batch.append(item)
            seen_accounts.add(acct)
            if len(batch) >= n:
                break

    print(json.dumps({
        "status": "ok",
        "posted_today": len(posted),
        "daily_cap": DAILY_CAP,
        "remaining_today": remaining,
        "swept": {"expired": expired, "blocked": blocked},
        "queue_size": len(pending),
        "comments": batch,
    }, indent=2))


def cmd_mark(comment_id, status, error=None):
    payload = {"status": status}
    if status == "posted":
        payload["posted_at"] = datetime.now(timezone.utc).isoformat()
    if error:
        payload["error"] = error
    rows = _call("PATCH", f"/engagement_queue?id=eq.{comment_id}", payload=payload, prefer="return=representation")
    if not rows:
        print(json.dumps({"status": "not_found", "comment_id": comment_id}))
        sys.exit(1)
    print(json.dumps({"status": "ok", "comment_id": comment_id, **({"posted_at": payload.get("posted_at")} if status == "posted" else {"error": error})}))


def cmd_stats():
    counts = {}
    for st in ("pending", "posted", "failed", "expired", "blocked_account"):
        rows = _call("GET", f"/engagement_queue?select=id&status=eq.{st}", prefer="count=exact")
        counts[st] = len(rows or [])
    posted = today_posted()
    pending_rows = _call("GET", "/engagement_queue?select=city&status=eq.pending") or []
    by_city = {}
    for r in pending_rows:
        by_city[r.get("city") or "?"] = by_city.get(r.get("city") or "?", 0) + 1
    print(json.dumps({
        "today": f"{len(posted)}/{DAILY_CAP}",
        "status_breakdown": counts,
        "postable_by_city": dict(sorted(by_city.items(), key=lambda x: -x[1])),
    }, indent=2))


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "stats":
        cmd_stats()
    elif args[0] == "next":
        cmd_next(int(args[1]) if len(args) > 1 else 4)
    elif args[0] == "mark-posted" and len(args) >= 2:
        cmd_mark(args[1], "posted")
    elif args[0] == "mark-failed" and len(args) >= 3:
        cmd_mark(args[1], "failed", " ".join(args[2:]))
    else:
        print(__doc__)
        sys.exit(1)

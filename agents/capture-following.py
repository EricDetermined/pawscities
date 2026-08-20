#!/usr/bin/env python3
"""
Record which Instagram accounts @thepawcities follows, into Supabase.

WHY
---
The brief was listing accounts to follow that we already follow. It had no idea
which they were: engagement_queue.followed_back records whether THEY follow US,
and nothing recorded the other direction. data/instagram-following.json exists
but was captured 2026-05-03 with 371 accounts against today's 253 — stale
enough to produce false negatives on accounts confirmed followed minutes
earlier.

HOW IT GETS THE DATA — AND WHY IT IS SLOW ON PURPOSE
----------------------------------------------------
This does NOT call Instagram itself. It takes a JSON payload captured from an
authenticated browser session and upserts it.

That split is deliberate. Probing Instagram's private endpoints from a script
is what got the account rate-limited in the first place: after roughly ten
profile lookups the API began returning 400s and profile pages stopped
rendering their Follow button. @thepawcities is the entire growth channel, and
following is the action Instagram polices hardest. So the network side stays in
the browser, at human pace, under supervision — and this file only handles
storage, which is the part worth automating.

Usage:
    # 1. In the browser console on instagram.com, paged gently, produce JSON
    #    of [{username, full_name, is_verified, is_private}, ...]
    # 2. Save it, then:
    python3 agents/capture-following.py following.json
    python3 agents/capture-following.py following.json --dry-run
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = 500


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
        sys.exit("Supabase credentials not found")
    return url, key


def req(url, key, path, method="GET", body=None, extra=None):
    headers = {"apikey": key, "Authorization": f"Bearer {key}",
               "Content-Type": "application/json"}
    headers.update(extra or {})
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{url}/rest/v1/{path}", data=data,
                               headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=90) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip() else []


def load(path):
    """Accept either a bare list or the shape data/instagram-following.json uses."""
    d = json.loads(Path(path).read_text())
    rows = d if isinstance(d, list) else (d.get("accounts") or d.get("users") or [])
    out, seen = [], set()
    for r in rows:
        u = (r.get("username") if isinstance(r, dict) else r) or ""
        u = u.strip().lstrip("@")
        # Usernames are our join key; a malformed one would silently fail to
        # match engagement_queue and reappear as a false "warm lead".
        if not u or u.lower() in seen:
            continue
        seen.add(u.lower())
        out.append({
            "username": u,
            "full_name": (r.get("full_name") if isinstance(r, dict) else None),
            "is_verified": bool(r.get("is_verified")) if isinstance(r, dict) else None,
            "is_private": bool(r.get("is_private")) if isinstance(r, dict) else None,
            "captured_at": datetime.now(timezone.utc).isoformat(),
        })
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        sys.exit(__doc__)
    url, key = env()

    rows = load(args[0])
    if not rows:
        sys.exit("no usernames found in that file")

    existing = {r["username"].lower()
                for r in req(url, key, "instagram_following?select=username")}
    new = [r for r in rows if r["username"].lower() not in existing]

    print(f"accounts in capture : {len(rows)}")
    print(f"  already recorded  : {len(rows) - len(new)}")
    print(f"  new               : {len(new)}")

    # An account we still have on file but did NOT see in this capture is one we
    # have since unfollowed. Reported, not deleted — the history is worth more
    # than the tidiness, and deleting would hide a mistaken unfollow.
    gone = existing - {r["username"].lower() for r in rows}
    if gone:
        print(f"  on file but not in this capture (unfollowed?): {len(gone)}")
        for g in sorted(gone)[:8]:
            print(f"      {g}")

    if dry:
        print("\n--dry-run: nothing written.")
        return 0

    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        # Pad to a uniform key set: PostgREST builds one INSERT from the first
        # object and rejects the batch otherwise (PGRST102).
        keys = set().union(*(c.keys() for c in chunk))
        for c in chunk:
            for k in keys:
                c.setdefault(k, None)
        try:
            req(url, key, "instagram_following?on_conflict=username", method="POST",
                body=chunk,
                extra={"Prefer": "resolution=merge-duplicates,return=minimal"})
            print(f"  stored {min(i + BATCH, len(rows))}/{len(rows)}")
        except urllib.error.HTTPError as e:
            print(f"FAILED: HTTP {e.code} {e.read().decode()[:300]}", file=sys.stderr)
            print("Has 025_instagram_following.sql been applied?", file=sys.stderr)
            return 1

    leads = req(url, key, "warm_leads?select=target_username,city")
    print(f"\nwarm_leads now: {len(leads)} accounts replied and are not yet followed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

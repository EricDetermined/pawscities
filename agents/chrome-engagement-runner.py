#!/usr/bin/env python3
"""
PawCities Chrome MCP Engagement Runner

Posts pending comments from the engagement queue using Chrome browser automation
instead of instagrapi (which is IP-blacklisted). This script is designed to be
run by Claude via Chrome MCP when the user's browser is available.

How it works:
  1. Reads pending/dry_run comments from data/engagement/comment-queue.json
  2. For each comment: navigates to the Instagram post URL, types the comment,
     and submits it
  3. Updates the queue file with posted status and timestamps
  4. Respects daily caps, batch breaks, and human-like delays

Usage:
  Called by Claude scheduled task or manually:
    python3 agents/chrome-engagement-runner.py preview     # Show what would be posted
    python3 agents/chrome-engagement-runner.py next        # Get next comment to post
    python3 agents/chrome-engagement-runner.py next 10     # Get next 10 comments
    python3 agents/chrome-engagement-runner.py mark-posted <comment-id>  # Mark as posted
    python3 agents/chrome-engagement-runner.py mark-failed <comment-id> <error>  # Mark as failed
    python3 agents/chrome-engagement-runner.py stats       # Show queue stats
    python3 agents/chrome-engagement-runner.py daily-report # Summary for scheduled task

Notes:
  - The actual browser automation (navigate, type, click) is done by Claude
    via Chrome MCP tools — this script just manages the queue state
  - Comments are posted from the user's real Chrome browser session,
    bypassing API-level IP blocks
  - Human-like behavior: Claude adds random delays between posts
"""

import json
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ─── Paths ──────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
ENGAGEMENT_DIR = DATA_DIR / "engagement"
QUEUE_FILE = ENGAGEMENT_DIR / "comment-queue.json"
HISTORY_FILE = ENGAGEMENT_DIR / "comment-history.json"
CONFIG_FILE = DATA_DIR / "engagement-config.json"


def load_queue():
    """Load the comment queue."""
    if not QUEUE_FILE.exists():
        return {"items": [], "stats": {"dry_run": 0, "posted": 0, "failed": 0, "blocked_safety": 0, "pending": 0, "generated": 0}}
    with open(QUEUE_FILE) as f:
        return json.load(f)


def save_queue(queue):
    """Save the comment queue."""
    with open(QUEUE_FILE, "w") as f:
        json.dump(queue, f, indent=2)


def load_history():
    """Load comment history.

    The history file is stored as {"comments": [...], "updated": "..."}.
    Older callers expected a bare list, so normalize to always return the
    list of comment records; use save_history() to persist it back.
    """
    if not HISTORY_FILE.exists():
        return []
    with open(HISTORY_FILE) as f:
        data = json.load(f)
    if isinstance(data, dict):
        return data.get("comments", [])
    return data


def save_history(history):
    """Save comment history, preserving the {"comments", "updated"} wrapper."""
    payload = {
        "comments": history,
        "updated": datetime.now(timezone.utc).isoformat(),
    }
    with open(HISTORY_FILE, "w") as f:
        json.dump(payload, f, indent=2)


def load_config():
    """Load engagement config."""
    if not CONFIG_FILE.exists():
        return {"daily_cap": 15, "timing": {"batch_size": 5}}
    with open(CONFIG_FILE) as f:
        return json.load(f)


CITY_SLUGS = [
    "london", "new-york-city", "los-angeles", "paris",
    "tokyo", "barcelona", "geneva", "sydney",
]


MAX_PENDING_AGE_DAYS = 7  # target posts older than this are stale — commenting looks late/bot-like

def load_influencer_targets():
    """Curated influencer handles (data/influencer-targets.json): {handle: {city, tier, notes}}.
    These accounts get selection priority — they drive outsized follower growth."""
    path = DATA_DIR / "influencer-targets.json"
    if path.exists():
        try:
            with open(path) as f:
                return {k.lower().lstrip("@"): v for k, v in json.load(f).items()}
        except Exception:
            return {}
    return {}


def get_postable_comments():
    """Get comments ready to be posted (pending or dry_run status).
    Auto-expires items older than MAX_PENDING_AGE_DAYS so we never comment on stale posts."""
    queue = load_queue()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=MAX_PENDING_AGE_DAYS)).isoformat()
    expired = 0
    for item in queue["items"]:
        if item["status"] in ("pending", "dry_run", "generated") and (item.get("created_at") or "") < cutoff:
            item["status"] = "expired"
            item["error"] = f"auto-expired: queued more than {MAX_PENDING_AGE_DAYS} days"
            expired += 1
    if expired:
        save_queue(queue)
        print(f"   (auto-expired {expired} stale queued comments)", file=sys.stderr)
    return [item for item in queue["items"] if item["status"] in ("pending", "dry_run", "generated")]


def get_today_posted_count():
    """Count how many comments were posted today."""
    queue = load_queue()
    today = datetime.now(timezone.utc).date().isoformat()
    return sum(1 for i in queue["items"]
               if i["status"] == "posted"
               and (i.get("posted_at") or "").startswith(today))


def get_today_posted_by_city():
    """Count how many comments were posted today per city."""
    queue = load_queue()
    today = datetime.now(timezone.utc).date().isoformat()
    by_city = {}
    for i in queue["items"]:
        if i["status"] == "posted" and (i.get("posted_at") or "").startswith(today):
            c = i.get("city") or "unknown"
            by_city[c] = by_city.get(c, 0) + 1
    return by_city


def select_balanced_batch(postable, limit):
    """Select a city-balanced, engagement-prioritized batch.

    Strategy:
      1. Round-robin across all 8 cities so every city gets representation
      2. Within each city, prefer higher-engagement posts (more likes = more
         visibility per comment)
      3. Fill remaining slots with best available regardless of city
      4. AI-generated comments get a slight priority boost over templates

    This ensures our 25 daily comments are spread across all cities and
    target the posts most likely to drive profile visits and followers.
    """
    if not postable or limit <= 0:
        return []

    # Group by city, sorted by post_likes descending within each
    by_city = {}
    no_city = []
    for item in postable:
        city = item.get("city")
        if city and city in CITY_SLUGS:
            by_city.setdefault(city, []).append(item)
        else:
            no_city.append(item)

    influencers = load_influencer_targets()
    for city in by_city:
        by_city[city].sort(key=lambda x: (
            # Priority 0: curated influencer targets always float to the top
            1 if (x.get("target_username") or "").lower().lstrip("@") in influencers else 0,
            # Primary: higher likes = more visibility
            x.get("post_likes", 0),
            # Secondary: AI-generated comments are more relevant
            1 if x.get("comment_category") == "ai_generated" else 0,
        ), reverse=True)

    no_city.sort(key=lambda x: x.get("post_likes", 0), reverse=True)

    # Check today's city distribution to compensate for imbalance
    today_by_city = get_today_posted_by_city()

    # Calculate target per city: aim for even spread
    # Cities that got fewer posts today get more slots
    city_deficit = {}
    avg_today = sum(today_by_city.values()) / max(len(CITY_SLUGS), 1)
    for city in CITY_SLUGS:
        posted_today = today_by_city.get(city, 0)
        available = len(by_city.get(city, []))
        # Deficit = how far below average + bonus for having inventory
        city_deficit[city] = (avg_today - posted_today + 0.5) if available > 0 else -999

    # Sort cities by deficit (most underserved first)
    city_order = sorted(CITY_SLUGS, key=lambda c: city_deficit.get(c, 0), reverse=True)

    selected = []
    selected_ids = set()

    # Phase 1: Round-robin — give each city at least 1-2 slots
    per_city_min = max(1, limit // len(CITY_SLUGS))
    for city in city_order:
        city_items = by_city.get(city, [])
        added = 0
        for item in city_items:
            if len(selected) >= limit:
                break
            if item["id"] not in selected_ids and added < per_city_min:
                selected.append(item)
                selected_ids.add(item["id"])
                added += 1

    # Phase 2: Fill remaining slots with highest-engagement posts across all cities
    all_remaining = []
    for city in CITY_SLUGS:
        for item in by_city.get(city, []):
            if item["id"] not in selected_ids:
                all_remaining.append(item)
    for item in no_city:
        if item["id"] not in selected_ids:
            all_remaining.append(item)

    all_remaining.sort(key=lambda x: x.get("post_likes", 0), reverse=True)

    for item in all_remaining:
        if len(selected) >= limit:
            break
        selected.append(item)
        selected_ids.add(item["id"])

    return selected


def cmd_preview():
    """Show what would be posted next, using city-balanced selection."""
    config = load_config()
    daily_cap = config.get("daily_cap", 25)
    today_posted = get_today_posted_count()
    remaining = max(0, daily_cap - today_posted)
    postable = get_postable_comments()

    print(f"\n🐾 Chrome MCP Engagement Runner — Preview")
    print(f"   Today: {today_posted}/{daily_cap} posted | {remaining} remaining")
    print(f"   Queue: {len(postable)} postable comments\n")

    if not postable:
        print("   No comments to post. Run discovery + generation first.")
        return

    # Use balanced selection
    batch = select_balanced_batch(postable, min(remaining, 25))
    cities = {}
    for item in batch:
        city = item.get("city", "unknown")
        cities[city] = cities.get(city, 0) + 1

    print(f"   Next batch: {len(batch)} comments (city-balanced, engagement-ranked)")
    print(f"   Cities: {', '.join(f'{c}({n})' for c, n in sorted(cities.items()))}\n")

    # Show today's city coverage
    today_by_city = get_today_posted_by_city()
    if today_by_city:
        print(f"   Already posted today: {', '.join(f'{c}({n})' for c, n in sorted(today_by_city.items()))}\n")

    for i, item in enumerate(batch[:10]):
        print(f"  {i+1}. @{item['target_username']} ({item.get('city', '?')}) [{item.get('post_likes',0)} likes]")
        print(f"     \"{item['comment_text'][:80]}...\"")
        print(f"     {item['post_url']}")
        print()


def cmd_next(limit=1):
    """Output the next comment(s) to post as JSON, city-balanced and engagement-ranked."""
    config = load_config()
    daily_cap = config.get("daily_cap", 25)
    today_posted = get_today_posted_count()
    remaining = max(0, daily_cap - today_posted)

    if remaining <= 0:
        print(json.dumps({"status": "daily_cap_reached", "posted_today": today_posted, "cap": daily_cap}))
        return

    postable = get_postable_comments()
    if not postable:
        print(json.dumps({"status": "queue_empty", "posted_today": today_posted}))
        return

    # Use balanced selection instead of FIFO
    batch = select_balanced_batch(postable, min(limit, remaining))

    # Show city distribution in the batch
    batch_cities = {}
    for item in batch:
        c = item.get("city", "unknown")
        batch_cities[c] = batch_cities.get(c, 0) + 1

    output = {
        "status": "ready",
        "posted_today": today_posted,
        "daily_cap": daily_cap,
        "remaining_today": remaining,
        "queue_size": len(postable),
        "batch_size": len(batch),
        "city_distribution": batch_cities,
        "comments": [{
            "id": item["id"],
            "post_url": item["post_url"],
            "post_shortcode": item.get("post_shortcode", ""),
            "target_username": item["target_username"],
            "city": item.get("city", "unknown"),
            "comment_text": item["comment_text"],
            "post_likes": item.get("post_likes", 0),
        } for item in batch]
    }
    print(json.dumps(output, indent=2))


def cmd_mark_posted(comment_id):
    """Mark a comment as successfully posted via Chrome MCP."""
    queue = load_queue()
    history = load_history()

    found = False
    for item in queue["items"]:
        if item["id"] == comment_id:
            item["status"] = "posted"
            item["posted_at"] = datetime.now(timezone.utc).isoformat()
            item["posted_via"] = "chrome_mcp"
            queue["stats"]["posted"] = queue["stats"].get("posted", 0) + 1

            # Add to history for reply tracking
            history.append({
                "post_id": item.get("post_id", ""),
                "post_url": item.get("post_url", ""),
                "post_shortcode": item.get("post_shortcode", ""),
                "target_username": item.get("target_username", ""),
                "comment_text": item.get("comment_text", ""),
                "city": item.get("city"),
                "posted_at": item["posted_at"],
                "posted_via": "chrome_mcp",
                "comment_pk": "",
                "media_pk": "",
                "reply_checked_at": None,
                "replies": [],
            })

            found = True
            print(json.dumps({"status": "ok", "comment_id": comment_id, "posted_at": item["posted_at"]}))
            break

    if not found:
        print(json.dumps({"status": "error", "message": f"Comment {comment_id} not found"}))
        return

    save_queue(queue)
    save_history(history)


def cmd_mark_failed(comment_id, error_msg="unknown"):
    """Mark a comment as failed."""
    queue = load_queue()

    for item in queue["items"]:
        if item["id"] == comment_id:
            item["status"] = "failed"
            item["error"] = error_msg[:200]
            item["failed_at"] = datetime.now(timezone.utc).isoformat()
            item["failed_via"] = "chrome_mcp"
            queue["stats"]["failed"] = queue["stats"].get("failed", 0) + 1
            save_queue(queue)
            print(json.dumps({"status": "ok", "comment_id": comment_id, "error": error_msg[:200]}))
            return

    print(json.dumps({"status": "error", "message": f"Comment {comment_id} not found"}))


def cmd_stats():
    """Show engagement stats."""
    queue = load_queue()
    config = load_config()
    daily_cap = config.get("daily_cap", 15)
    today_posted = get_today_posted_count()

    statuses = {}
    cities = {}
    for item in queue["items"]:
        s = item["status"]
        statuses[s] = statuses.get(s, 0) + 1
        if s in ("pending", "dry_run", "generated"):
            city = item.get("city", "unknown")
            cities[city] = cities.get(city, 0) + 1

    print(f"\n🐾 Engagement Queue Stats")
    print(f"   Total items: {len(queue['items'])}")
    print(f"   Today: {today_posted}/{daily_cap}")
    print(f"\n   Status breakdown:")
    for s, count in sorted(statuses.items()):
        print(f"     {s}: {count}")
    print(f"\n   Postable by city:")
    for c, count in sorted(cities.items(), key=lambda x: -x[1]):
        print(f"     {c}: {count}")
    print()


def cmd_daily_report():
    """Generate a daily report for the scheduled task."""
    queue = load_queue()
    config = load_config()
    daily_cap = config.get("daily_cap", 25)
    today_posted = get_today_posted_count()
    postable = get_postable_comments()

    # Chrome MCP posts today
    today = datetime.now(timezone.utc).date().isoformat()
    chrome_today = sum(1 for i in queue["items"]
                       if i.get("posted_via") in ("chrome_mcp", "chrome_mcp_scheduled")
                       and (i.get("posted_at") or "").startswith(today))

    # City health: which cities have inventory?
    pending_by_city = {}
    for item in postable:
        c = item.get("city") or "unknown"
        pending_by_city[c] = pending_by_city.get(c, 0) + 1

    city_gaps = [c for c in CITY_SLUGS if pending_by_city.get(c, 0) == 0]
    low_cities = [c for c in CITY_SLUGS if 0 < pending_by_city.get(c, 0) <= 5]

    # Engagement quality: what's the median post_likes in queue?
    likes = sorted(i.get("post_likes", 0) for i in postable)
    median_likes = likes[len(likes)//2] if likes else 0
    high_value = sum(1 for l in likes if l >= 50)

    # Days of runway at current rate
    runway_days = len(postable) / daily_cap if daily_cap > 0 else 999

    report = {
        "date": today,
        "posted_today": today_posted,
        "posted_via_chrome": chrome_today,
        "daily_cap": daily_cap,
        "queue_pending": len(postable),
        "runway_days": round(runway_days, 1),
        "pending_by_city": pending_by_city,
        "city_gaps": city_gaps,
        "low_inventory_cities": low_cities,
        "median_target_likes": median_likes,
        "high_value_targets": high_value,
        "total_posted_all_time": sum(1 for i in queue["items"] if i["status"] == "posted"),
        "total_failed": sum(1 for i in queue["items"] if i["status"] == "failed"),
        "needs_discovery": len(postable) < 150 or len(city_gaps) > 0,
        "needs_generation": len(postable) < 75,
        "needs_high_value_discovery": high_value < 10,
    }
    print(json.dumps(report, indent=2))


# ─── Main ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: chrome-engagement-runner.py <command> [args]")
        print("Commands: preview, next [limit], mark-posted <id>, mark-failed <id> [error], stats, daily-report")
        sys.exit(1)

    command = sys.argv[1]

    if command == "preview":
        cmd_preview()
    elif command == "next":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        cmd_next(limit)
    elif command == "mark-posted":
        if len(sys.argv) < 3:
            print("Usage: mark-posted <comment-id>")
            sys.exit(1)
        cmd_mark_posted(sys.argv[2])
    elif command == "mark-failed":
        if len(sys.argv) < 3:
            print("Usage: mark-failed <comment-id> [error-message]")
            sys.exit(1)
        error = sys.argv[3] if len(sys.argv) > 3 else "unknown"
        cmd_mark_failed(sys.argv[2], error)
    elif command == "stats":
        cmd_stats()
    elif command == "daily-report":
        cmd_daily_report()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

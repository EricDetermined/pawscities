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
from datetime import datetime, timezone
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
    """Load comment history."""
    if not HISTORY_FILE.exists():
        return []
    with open(HISTORY_FILE) as f:
        return json.load(f)


def save_history(history):
    """Save comment history."""
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def load_config():
    """Load engagement config."""
    if not CONFIG_FILE.exists():
        return {"daily_cap": 15, "timing": {"batch_size": 5}}
    with open(CONFIG_FILE) as f:
        return json.load(f)


def get_postable_comments():
    """Get comments ready to be posted (pending or dry_run status)."""
    queue = load_queue()
    return [item for item in queue["items"] if item["status"] in ("pending", "dry_run", "generated")]


def get_today_posted_count():
    """Count how many comments were posted today."""
    queue = load_queue()
    today = datetime.now(timezone.utc).date().isoformat()
    return sum(1 for i in queue["items"]
               if i["status"] == "posted"
               and (i.get("posted_at") or "").startswith(today))


def cmd_preview():
    """Show what would be posted next."""
    config = load_config()
    daily_cap = config.get("daily_cap", 15)
    today_posted = get_today_posted_count()
    remaining = max(0, daily_cap - today_posted)
    postable = get_postable_comments()

    print(f"\n🐾 Chrome MCP Engagement Runner — Preview")
    print(f"   Today: {today_posted}/{daily_cap} posted | {remaining} remaining")
    print(f"   Queue: {len(postable)} postable comments\n")

    if not postable:
        print("   No comments to post. Run discovery + generation first.")
        return

    # Show next batch
    batch = postable[:min(remaining, 15)]
    cities = {}
    for item in batch:
        city = item.get("city", "unknown")
        cities[city] = cities.get(city, 0) + 1

    print(f"   Next batch: {len(batch)} comments")
    print(f"   Cities: {', '.join(f'{c}({n})' for c, n in sorted(cities.items()))}\n")

    for i, item in enumerate(batch[:10]):
        print(f"  {i+1}. @{item['target_username']} ({item.get('city', '?')})")
        print(f"     \"{item['comment_text'][:80]}...\"")
        print(f"     {item['post_url']}")
        print()


def cmd_next(limit=1):
    """Output the next comment(s) to post as JSON for Claude to process."""
    config = load_config()
    daily_cap = config.get("daily_cap", 15)
    today_posted = get_today_posted_count()
    remaining = max(0, daily_cap - today_posted)

    if remaining <= 0:
        print(json.dumps({"status": "daily_cap_reached", "posted_today": today_posted, "cap": daily_cap}))
        return

    postable = get_postable_comments()
    if not postable:
        print(json.dumps({"status": "queue_empty", "posted_today": today_posted}))
        return

    batch = postable[:min(limit, remaining)]
    output = {
        "status": "ready",
        "posted_today": today_posted,
        "daily_cap": daily_cap,
        "remaining_today": remaining,
        "queue_size": len(postable),
        "batch_size": len(batch),
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
    daily_cap = config.get("daily_cap", 15)
    today_posted = get_today_posted_count()
    postable = get_postable_comments()

    # Chrome MCP posts today
    today = datetime.now(timezone.utc).date().isoformat()
    chrome_today = sum(1 for i in queue["items"]
                       if i.get("posted_via") == "chrome_mcp"
                       and (i.get("posted_at") or "").startswith(today))

    report = {
        "date": today,
        "posted_today": today_posted,
        "posted_via_chrome": chrome_today,
        "daily_cap": daily_cap,
        "queue_pending": len(postable),
        "total_posted_all_time": sum(1 for i in queue["items"] if i["status"] == "posted"),
        "total_failed": sum(1 for i in queue["items"] if i["status"] == "failed"),
        "needs_discovery": len(postable) < 50,
        "needs_generation": len(postable) < 20,
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

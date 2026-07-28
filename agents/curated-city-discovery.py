#!/usr/bin/env python3
"""Targeted curated-account discovery for low-volume cities (Barcelona, Geneva).

Scrapes recent posts from the curated city accounts in
instagram-following.json city_breakdown via the Apify profile scraper and
writes them to discovered-posts.json in the same shape as hashtag discovery,
so `engagement-bot.py generate` can consume them.

These accounts are pre-vetted as city-tied, so posts pass the curated-list
evidence gate. min_likes is relaxed vs hashtag discovery because small-market
business accounts have lower engagement but higher relevance.

Usage:
  APIFY_TOKEN=... python3 agents/curated-city-discovery.py barcelona geneva
"""
import importlib.util
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("engagement_bot", REPO / "agents" / "engagement-bot.py")
eb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eb)

MIN_LIKES = 5          # relaxed for small-market curated accounts
MAX_AGE_DAYS = 10      # slightly wider window than hashtag discovery
BATCH_SIZE = 30


def main(cities):
    following = json.load(open(REPO / "data" / "instagram-following.json"))
    cb = following.get("city_breakdown", {})
    norm = {"los_angeles": "los-angeles", "new_york": "new-york-city"}

    handle_city = {}
    for raw_city, users in cb.items():
        slug = norm.get(raw_city, raw_city.replace("_", "-"))
        if slug in cities:
            for u in users:
                handle_city[u.lower()] = slug

    usernames = [u for u in handle_city if u not in eb.ACCOUNT_BLOCKLIST]
    print(f"🐕 Curated city discovery: {cities} → {len(usernames)} accounts")

    all_posts = []
    batches = [usernames[i:i + BATCH_SIZE] for i in range(0, len(usernames), BATCH_SIZE)]
    for n, batch in enumerate(batches, 1):
        print(f"  📦 Batch {n}/{len(batches)}: {len(batch)} accounts...")
        result = eb.apify_request("POST", "/acts/apify~instagram-profile-scraper/runs", {
            "usernames": batch,
            "resultsLimit": 3,
        })
        if not (result and result.get("data", {}).get("id")):
            print("    ❌ Failed to start scraper")
            continue
        run_id = result["data"]["id"]
        dataset_id = result["data"]["defaultDatasetId"]
        status = None
        for _ in range(30):
            time.sleep(10)
            status = eb.apify_request("GET", f"/actor-runs/{run_id}")
            st = status.get("data", {}).get("status", "") if status else ""
            if st in ("SUCCEEDED", "FAILED", "ABORTED"):
                break
        if not status or status.get("data", {}).get("status") != "SUCCEEDED":
            print(f"    ❌ Run status: {status.get('data', {}).get('status') if status else 'UNKNOWN'}")
            continue
        items = eb.apify_request("GET", f"/datasets/{dataset_id}/items?limit=500")
        if not isinstance(items, list):
            print("    ⚠️ No items")
            continue
        got = 0
        for profile in items:
            username = (profile.get("username") or "").lower()
            for post in profile.get("latestPosts", []):
                post["ownerUsername"] = username
                post["_city"] = handle_city.get(username)
                post["_discovered_at"] = datetime.now(timezone.utc).isoformat()
                post["_source"] = "curated-city"
                all_posts.append(post)
                got += 1
        print(f"    📦 Got {got} posts from {len(items)} profiles")

    # Normalize + filter (mirrors engagement-bot discovery save shape)
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    history = eb.load_history()
    commented = {h["post_id"] for h in history}
    filtered, seen, safety_blocked = [], set(), 0

    for post in all_posts:
        post_id = post.get("id", "") or post.get("shortCode", "")
        if not post_id or post_id in seen or post_id in commented:
            continue
        seen.add(post_id)
        if (post.get("likesCount") or 0) < MIN_LIKES:
            continue
        try:
            ts = datetime.fromisoformat((post.get("timestamp") or "").replace("Z", "+00:00"))
            if ts < cutoff:
                continue
        except (ValueError, TypeError):
            continue  # curated channel: require a timestamp (freshness gate)
        caption = (post.get("caption") or "")[:500]
        owner = post.get("ownerUsername", "")
        is_safe, reason = eb.screen_post_content(caption, post_id, owner)
        if not is_safe:
            print(f"    🛡️ BLOCKED @{owner}: {reason}")
            safety_blocked += 1
            continue
        filtered.append({
            "id": post_id,
            "shortcode": post.get("shortCode", ""),
            "ownerUsername": owner,
            "ownerId": post.get("ownerId", ""),
            "caption": caption,
            "hashtags": post.get("hashtags", []),
            "mentions": post.get("mentions", []),
            "locationName": post.get("locationName"),
            "likesCount": post.get("likesCount", 0),
            "commentsCount": post.get("commentsCount", 0),
            "timestamp": post.get("timestamp"),
            "url": post.get("url", "") or f"https://www.instagram.com/p/{post.get('shortCode','')}/",
            "displayUrl": post.get("displayUrl", ""),
            "city": post.get("_city"),
            "detectedCity": eb.detect_city(caption, post.get("hashtags", []), post.get("locationName")),
            "discoveredAt": post.get("_discovered_at"),
            "safetyCheck": reason,
        })

    filtered.sort(key=lambda p: p.get("likesCount", 0), reverse=True)
    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "total_raw": len(all_posts),
        "total_filtered": len(filtered),
        "safety_blocked": safety_blocked,
        "posts": filtered,
    }
    with open(eb.POSTS_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  📊 Curated discovery: {len(all_posts)} raw → {len(filtered)} eligible")
    print(f"  💾 Saved to {eb.POSTS_FILE}")
    print("  Next: python3 agents/engagement-bot.py generate")


if __name__ == "__main__":
    cities = sys.argv[1:] or ["barcelona", "geneva"]
    main(cities)

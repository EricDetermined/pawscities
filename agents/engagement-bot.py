#!/usr/bin/env python3
"""
PawCities Engagement Bot

Automated Instagram commenting at scale to build @thepawcities brand presence.
Discovers relevant dog-friendly posts across 8 cities, generates contextual comments,
and executes them via instagrapi with human-like timing patterns.

Architecture:
  OUTBOUND (grow visibility):
    1. DISCOVER  - Uses Apify to find relevant posts (hashtags, locations, followed accounts)
    2. GENERATE  - Creates varied, contextual comments (not spam)
    3. QUEUE     - Schedules with randomized delays and daily caps
    4. EXECUTE   - Posts comments via instagrapi with session persistence

  INBOUND (convert engagement to followers):
    5. MONITOR   - Checks posted comments for replies
    6. RE-ENGAGE - Generates contextual follow-up replies to warm leads
    7. FOLLOW    - Auto-follows accounts that engage back with us
    8. TRACK     - Logs everything for the engagement dashboard

Usage:
  # ── Outbound ──
  python3 engagement-bot.py discover                    # Find new posts to engage with
  python3 engagement-bot.py discover --city tokyo       # Single city
  python3 engagement-bot.py discover-following          # Scrape followed accounts (weekly)
  python3 engagement-bot.py generate                    # Generate comments for discovered posts
  python3 engagement-bot.py queue                       # Show queue status
  python3 engagement-bot.py run                         # Execute queued comments (main loop)
  python3 engagement-bot.py run --dry-run               # Preview without posting
  python3 engagement-bot.py run --limit 10              # Execute N comments then stop

  # ── Inbound ──
  python3 engagement-bot.py monitor-replies             # Check our comments for replies
  python3 engagement-bot.py monitor-replies --max 30    # Check N most recent comments
  python3 engagement-bot.py generate-replies            # Generate re-engagement responses
  python3 engagement-bot.py reply                       # Send re-engagement replies
  python3 engagement-bot.py reply --limit 10            # Send N re-engagement replies
  python3 engagement-bot.py follow-back                 # Follow accounts that replied to us
  python3 engagement-bot.py follow-back --limit 5       # Follow N accounts

  # ── Utility ──
  python3 engagement-bot.py stats                       # Show engagement statistics
  python3 engagement-bot.py login                       # Set up Instagram session
  python3 engagement-bot.py test                        # Post one test comment

Environment:
  IG_USERNAME          - Instagram username for @thepawcities
  IG_PASSWORD          - Instagram password
  APIFY_TOKEN          - Apify API token
  IG_PROXY             - Optional: residential proxy (socks5://user:pass@host:port)
  IG_SESSION_PATH      - Optional: path to persist session (default: ./data/ig-session.json)
"""

import os
import sys
import json
import time
import random
import hashlib
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ─── Paths ───────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
ENGAGEMENT_DIR = DATA_DIR / "engagement"
QUEUE_FILE = ENGAGEMENT_DIR / "comment-queue.json"
HISTORY_FILE = ENGAGEMENT_DIR / "comment-history.json"
POSTS_FILE = ENGAGEMENT_DIR / "discovered-posts.json"
SESSION_FILE = Path(os.environ.get("IG_SESSION_PATH", str(ENGAGEMENT_DIR / "ig-session.json")))
CONFIG_FILE = DATA_DIR / "engagement-config.json"

# Ensure dirs exist
ENGAGEMENT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Config ──────────────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "version": "1.0",
    "daily_cap": 50,
    "ramp_schedule": {
        "week_1": 50,
        "week_2": 80,
        "week_3": 120,
        "week_4": 180,
        "week_5_plus": 250
    },
    "timing": {
        "min_delay_seconds": 45,
        "max_delay_seconds": 120,
        "batch_size": 20,
        "batch_break_min_seconds": 300,
        "batch_break_max_seconds": 600,
        "active_hours_start": 7,
        "active_hours_end": 23,
        "timezone": "UTC"
    },
    "discovery": {
        "results_per_hashtag": 15,
        "min_likes": 5,
        "max_age_days": 7,
        "skip_verified_accounts": False,
        "skip_private_accounts": True
    },
    "hashtags": {
        "global": [
            "dogfriendly", "dogsofinstagram", "doglovers", "doglife",
            "dogtravel", "travelwithdog", "dogcafe", "dogrestaurant",
            "dogfriendlyhotel", "dogfriendlybeach", "dogpark",
            "puppylove", "dogmom", "dogdad", "doglover"
        ],
        "los-angeles": [
            "dogfriendlyLA", "dogsofLA", "LAdogs", "dogfriendlysocal",
            "LAdogpark", "socaldogs", "dogbeachLA", "dogcafeLA"
        ],
        "new-york-city": [
            "dogsofnyc", "nycdog", "dogfriendlyNYC", "dogfriendlybrooklyn",
            "nycdogpark", "nycdoglife", "dogsofbrooklyn", "nycpuppy"
        ],
        "london": [
            "dogfriendlylondon", "londondogs", "dogsofLondon",
            "dogfriendlyUK", "londonpuppy", "dogpubslondon"
        ],
        "barcelona": [
            "dogfriendlybarcelona", "perrosdebarcelona", "perrobarcelona",
            "dogfriendlyspain", "dogbarcelona", "mascotabarcelona"
        ],
        "paris": [
            "chienparis", "chienstagram", "parischien",
            "dogfriendlyparis", "chienfriendly", "chiendeparis"
        ],
        "tokyo": [
            "犬スタグラム", "犬のいる暮らし", "ドッグカフェ",
            "犬とお出かけ", "ドッグフレンドリー", "東京犬"
        ],
        "geneva": [
            "dogfriendlyswiss", "swissdogs", "chienssuisses",
            "dogfriendlygeneva", "hundeschweiz"
        ],
        "sydney": [
            "dogsofsydney", "dogfriendlysydney", "sydneydogs",
            "dogfriendlyaustralia", "dogsofaustralia", "dogbeachsydney"
        ]
    },
    "cities": {
        "los-angeles": {"name": "Los Angeles", "tz": "America/Los_Angeles"},
        "new-york-city": {"name": "New York City", "tz": "America/New_York"},
        "london": {"name": "London", "tz": "Europe/London"},
        "barcelona": {"name": "Barcelona", "tz": "Europe/Madrid"},
        "paris": {"name": "Paris", "tz": "Europe/Paris"},
        "tokyo": {"name": "東京 (Tokyo)", "tz": "Asia/Tokyo"},
        "geneva": {"name": "Geneva", "tz": "Europe/Zurich"},
        "sydney": {"name": "Sydney", "tz": "Australia/Sydney"}
    }
}


def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return json.load(f)
    # Write default config
    with open(CONFIG_FILE, "w") as f:
        json.dump(DEFAULT_CONFIG, f, indent=2)
    return DEFAULT_CONFIG


# ─── Comment Templates ───────────────────────────────────────────────────────

COMMENT_TEMPLATES = {
    "appreciation": [
        "Love this! {city_ref}is such a great spot for dogs 🐾",
        "This made our day! Nothing better than seeing happy pups out exploring 💛",
        "What a beautiful {place_type}! Your dog looks like they're having the best time",
        "This is exactly why we love {city_ref}— so many dog-friendly gems to discover!",
        "Adorable! We're always looking for places like this to share with dog owners 🐕",
        "Such a great find! More dog parents need to know about spots like this",
        "Your pup is living the dream! {city_ref}has so many great options for dogs",
        "This looks amazing! We love discovering dog-friendly spots like this 🙌",
    ],
    "question": [
        "Love this! Do they provide water bowls for dogs too? 💧",
        "This looks incredible! Is this spot usually busy with dogs or more of a hidden gem?",
        "Amazing shot! How did your pup handle the {context}? Ours would go crazy 😂",
        "Such a great vibe! Do you visit here often with your dog?",
        "Beautiful! Is this place easy to get to with a bigger dog?",
        "Love the energy here! Any tips for first-time visitors with dogs?",
    ],
    "recommendation": [
        "Great choice! If you love this, you should check out more spots in {city_ref}on pawcities.com 🐾",
        "Perfect spot! We feature places like this on Paw Cities — always great to see them getting love",
        "This is why we built pawcities.com — to help dog owners find amazing places like this! Love it 🧡",
        "Another reason to love {city_ref}! We've mapped tons of dog-friendly spots there at pawcities.com",
    ],
    "empathy": [
        "We know that look — pure happiness! Dogs just make everything better 💛",
        "That face says it all! Nothing beats a good adventure with your best friend",
        "This is what it's all about — making memories with our four-legged family 🐾",
        "Your dog is living their best life and honestly, we're here for it 😍",
    ],
    "local_knowledge": [
        "Such a great spot in {city_name}! Have you explored the {area} area too?",
        "{city_name} is so underrated for dog-friendly adventures — love seeing this!",
        "One of the best things about {city_name} is how dog-friendly it is. Great find!",
    ],
    # Non-English templates
    "french": [
        "Magnifique ! Votre chien a l'air tellement heureux 🐾💛",
        "On adore ! {city_name} est vraiment top pour les chiens",
        "Trop mignon ! Merci de partager ces endroits dog-friendly 🧡",
        "Super trouvaille ! Les toutous méritent les meilleurs endroits 🐕",
    ],
    "spanish": [
        "¡Qué bonito! Tu perro se ve muy feliz aquí 🐾",
        "¡Increíble lugar! {city_name} tiene sitios geniales para perros",
        "Nos encanta ver lugares así de dog-friendly 🧡",
        "¡Qué descubrimiento! Los perritos merecen los mejores paseos 🐕",
    ],
    "japanese": [
        "最高ですね！ワンちゃんもとっても楽しそう🐾",
        "素敵な場所！{city_name}はワンコに優しい街ですね💛",
        "めちゃくちゃかわいい！犬と一緒にお出かけ最高ですね🐕",
        "こういうドッグフレンドリーな場所、もっと知りたいです🧡",
    ],
    "german": [
        "Wunderschön! Euer Hund sieht so glücklich aus 🐾",
        "Toll! {city_name} ist wirklich hundefreundlich 💛",
        "So schön! Hunde verdienen die besten Abenteuer 🐕",
    ],
}

# Place type mapping based on hashtags/content
PLACE_TYPES = {
    "cafe": ["cafe", "coffee", "latte", "cappuccino", "brunch", "カフェ"],
    "restaurant": ["restaurant", "dinner", "lunch", "food", "dining", "eat", "レストラン"],
    "beach": ["beach", "sand", "ocean", "waves", "shore", "playa", "plage", "ビーチ"],
    "park": ["park", "trail", "hike", "walk", "nature", "green", "公園"],
    "hotel": ["hotel", "stay", "accommodation", "resort", "check-in", "ホテル"],
    "bar": ["bar", "pub", "brewery", "beer", "wine", "cocktail"],
    "shop": ["shop", "store", "boutique", "pet shop", "ショップ"],
}


def detect_language(caption):
    """Simple language detection based on character analysis."""
    if not caption:
        return "english"
    # Japanese
    if any('぀' <= c <= 'ヿ' or '一' <= c <= '鿿' for c in caption[:200]):
        return "japanese"
    # French indicators
    french_words = ["chien", "toutou", "promenade", "balade", "magnifique", "endroit", "mignon"]
    if sum(1 for w in french_words if w in caption.lower()) >= 2:
        return "french"
    # Spanish indicators
    spanish_words = ["perro", "mascota", "paseo", "bonito", "increíble", "lugar", "hermoso", "nuestro", "playa", "feliz"]
    if sum(1 for w in spanish_words if w in caption.lower()) >= 1:
        return "spanish"
    # German indicators
    german_words = ["hund", "spaziergang", "schön", "wunderbar", "gassi", "hundeplatz"]
    if sum(1 for w in german_words if w in caption.lower()) >= 2:
        return "german"
    return "english"


def detect_place_type(caption, hashtags):
    """Detect what kind of place the post is about."""
    text = (caption or "").lower() + " " + " ".join(hashtags or []).lower()
    for ptype, keywords in PLACE_TYPES.items():
        if any(kw in text for kw in keywords):
            return ptype
    return "spot"


def detect_city(caption, hashtags, location):
    """Try to detect which city the post is about."""
    text = ((caption or "") + " " + " ".join(hashtags or []) + " " + (location or "")).lower()
    city_signals = {
        "los-angeles": ["los angeles", "la ", "socal", "hollywood", "santa monica", "venice beach"],
        "new-york-city": ["new york", "nyc", "brooklyn", "manhattan", "queens", "bronx"],
        "london": ["london", "uk ", "england", "brixton", "shoreditch", "camden"],
        "barcelona": ["barcelona", "bcn", "cataluña", "catalunya"],
        "paris": ["paris", "parisien", "montmartre", "marais"],
        "tokyo": ["tokyo", "東京", "渋谷", "新宿", "代々木"],
        "geneva": ["geneva", "genève", "geneve", "suisse", "swiss", "switzerland", "zürich", "zurich"],
        "sydney": ["sydney", "bondi", "manly", "australia"],
    }
    for city_slug, signals in city_signals.items():
        if any(s in text for s in signals):
            return city_slug
    return None


def generate_comment(post, config):
    """Generate a contextual, non-spammy comment for a post."""
    caption = post.get("caption", "") or ""
    hashtags = post.get("hashtags", [])
    location = post.get("locationName", "")
    username = post.get("ownerUsername", "")

    language = detect_language(caption)
    place_type = detect_place_type(caption, hashtags)
    city_slug = post.get("city") or detect_city(caption, hashtags, location)
    city_name = config["cities"].get(city_slug, {}).get("name", "") if city_slug else ""

    # Pick template category with weighted randomness
    # Mostly appreciation/empathy (brand-safe), occasionally questions or recommendations
    category_weights = {
        "appreciation": 35,
        "empathy": 25,
        "question": 20,
        "local_knowledge": 10,
        "recommendation": 10,
    }

    # Use language-specific templates when applicable
    if language == "french":
        category_weights = {"french": 70, "appreciation": 20, "empathy": 10}
    elif language == "spanish":
        category_weights = {"spanish": 70, "appreciation": 20, "empathy": 10}
    elif language == "japanese":
        category_weights = {"japanese": 70, "appreciation": 20, "empathy": 10}
    elif language == "german":
        category_weights = {"german": 60, "appreciation": 25, "empathy": 15}

    # Weighted random selection
    categories = list(category_weights.keys())
    weights = list(category_weights.values())
    total = sum(weights)
    r = random.uniform(0, total)
    cumulative = 0
    chosen_category = categories[0]
    for cat, w in zip(categories, weights):
        cumulative += w
        if r <= cumulative:
            chosen_category = cat
            break

    templates = COMMENT_TEMPLATES.get(chosen_category, COMMENT_TEMPLATES["appreciation"])
    template = random.choice(templates)

    # Fill in placeholders
    city_ref = f"{city_name} " if city_name else ""
    area = location.split(",")[0] if location else city_name

    comment = template.format(
        city_ref=city_ref,
        city_name=city_name or "this city",
        place_type=place_type,
        context=place_type,
        area=area or "the neighborhood",
    )

    # Add slight variation: occasionally add/remove emoji, change punctuation
    if random.random() < 0.3:
        extra_emojis = ["🐶", "❤️", "✨", "🙌", "😊", "🌟", "💕", "🎉"]
        comment += " " + random.choice(extra_emojis)

    # Ensure we don't repeat the same comment on the same post
    comment_hash = hashlib.md5(f"{username}:{comment[:30]}".encode()).hexdigest()[:8]

    return {
        "text": comment,
        "category": chosen_category,
        "language": language,
        "hash": comment_hash,
        "place_type": place_type,
        "detected_city": city_slug,
    }


# ─── Apify Post Discovery ───────────────────────────────────────────────────

def apify_request(method, api_path, body=None):
    """Make a request to the Apify API."""
    token = os.environ.get("APIFY_TOKEN", "")
    if not token:
        print("ERROR: APIFY_TOKEN environment variable not set")
        sys.exit(1)

    url = f"https://api.apify.com/v2{api_path}?token={token}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ""
        print(f"Apify API error {e.code}: {error_body[:200]}")
        return None


def discover_posts(target_city=None):
    """Discover new posts to engage with using Apify hashtag scraper."""
    config = load_config()

    # Determine which cities and hashtags to scrape
    cities_to_scrape = {}
    if target_city:
        if target_city in config["hashtags"]:
            cities_to_scrape[target_city] = config["hashtags"][target_city]
        else:
            print(f"Unknown city: {target_city}")
            return
    else:
        for city_slug in config["cities"]:
            city_tags = config["hashtags"].get(city_slug, [])
            cities_to_scrape[city_slug] = city_tags

    # Add global hashtags
    global_tags = config["hashtags"].get("global", [])

    print(f"\n🐕 PawCities Engagement Bot — Post Discovery")
    print(f"   Cities: {len(cities_to_scrape)} | Global tags: {len(global_tags)}\n")

    all_posts = []
    results_per = config["discovery"]["results_per_hashtag"]

    for city_slug, city_tags in cities_to_scrape.items():
        city_name = config["cities"][city_slug]["name"]
        all_tags = list(set(global_tags + city_tags))

        # Sample a subset to control cost — 8 tags per city per run
        sampled_tags = random.sample(all_tags, min(8, len(all_tags)))

        print(f"  📍 {city_name}: scraping {len(sampled_tags)} hashtags × {results_per} results...")

        result = apify_request("POST", "/acts/apify~instagram-hashtag-scraper/runs", {
            "hashtags": sampled_tags,
            "resultsLimit": results_per,
        })

        if result and result.get("data", {}).get("id"):
            run_id = result["data"]["id"]
            dataset_id = result["data"]["defaultDatasetId"]
            print(f"    ✅ Run {run_id} started (dataset: {dataset_id})")

            # Wait for completion (poll every 10s, max 5 min)
            for _ in range(30):
                time.sleep(10)
                status = apify_request("GET", f"/actor-runs/{run_id}")
                if status and status.get("data", {}).get("status") in ("SUCCEEDED", "FAILED", "ABORTED"):
                    break
                print("    ⏳ Still running...")

            run_status = status.get("data", {}).get("status") if status else "UNKNOWN"
            if run_status == "SUCCEEDED":
                # Pull results
                items = apify_request("GET", f"/datasets/{dataset_id}/items?limit=500")
                if items:
                    posts = items if isinstance(items, list) else []
                    print(f"    📦 Got {len(posts)} posts")

                    for post in posts:
                        post["_city"] = city_slug
                        post["_discovered_at"] = datetime.now(timezone.utc).isoformat()
                    all_posts.extend(posts)
                else:
                    print(f"    ⚠️ No items returned")
            else:
                print(f"    ❌ Run ended with status: {run_status}")
        else:
            print(f"    ❌ Failed to start scraper")

        # Delay between city scrapes
        time.sleep(3)

    # Filter posts
    min_likes = config["discovery"]["min_likes"]
    max_age = config["discovery"]["max_age_days"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age)

    filtered = []
    seen_ids = set()

    # Load history to avoid re-commenting
    history = load_history()
    commented_post_ids = {h["post_id"] for h in history}

    for post in all_posts:
        post_id = post.get("id", "")
        if post_id in seen_ids or post_id in commented_post_ids:
            continue
        seen_ids.add(post_id)

        # Skip low engagement
        if (post.get("likesCount") or 0) < min_likes:
            continue

        # Skip old posts
        try:
            post_date = datetime.fromisoformat(post.get("timestamp", "").replace("Z", "+00:00"))
            if post_date < cutoff:
                continue
        except (ValueError, TypeError):
            pass

        # Skip private accounts
        if config["discovery"]["skip_private_accounts"] and post.get("isPrivate"):
            continue

        filtered.append({
            "id": post_id,
            "shortcode": post.get("shortCode", ""),
            "ownerUsername": post.get("ownerUsername", ""),
            "ownerId": post.get("ownerId", ""),
            "caption": (post.get("caption") or "")[:500],
            "hashtags": post.get("hashtags", []),
            "mentions": post.get("mentions", []),
            "locationName": post.get("locationName"),
            "likesCount": post.get("likesCount", 0),
            "commentsCount": post.get("commentsCount", 0),
            "timestamp": post.get("timestamp"),
            "url": post.get("url", ""),
            "displayUrl": post.get("displayUrl", ""),
            "city": post.get("_city"),
            "discoveredAt": post.get("_discovered_at"),
        })

    # Sort by engagement
    filtered.sort(key=lambda p: p.get("likesCount", 0), reverse=True)

    # Save
    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "total_raw": len(all_posts),
        "total_filtered": len(filtered),
        "posts": filtered,
    }
    with open(POSTS_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n  📊 Discovery complete: {len(all_posts)} raw → {len(filtered)} eligible posts")
    print(f"  💾 Saved to {POSTS_FILE}\n")

    # Show top 5
    for i, p in enumerate(filtered[:5]):
        print(f"  {i+1}. @{p['ownerUsername']} | {p['likesCount']}❤️ | {p['city'] or '?'}")
        print(f"     {(p['caption'] or '')[:80]}...")
        print(f"     {p['url']}\n")

    return output


# ─── Followed Accounts Discovery ─────────────────────────────────────────────

FOLLOWING_FILE = DATA_DIR / "instagram-following.json"

def discover_following():
    """Discover recent posts from accounts we follow using Apify profile scraper.

    Designed to run weekly (Mondays) to complement the daily hashtag discovery.
    Scrapes recent posts from our 188 followed accounts, focusing on those
    tagged to specific cities for targeted engagement.
    """
    config = load_config()

    if not FOLLOWING_FILE.exists():
        print("❌ No instagram-following.json found. Cannot discover following.")
        return

    with open(FOLLOWING_FILE) as f:
        following_data = json.load(f)

    accounts = following_data.get("accounts", [])
    if not accounts:
        print("❌ No accounts in following list.")
        return

    # Extract usernames, prioritizing city-tagged accounts
    city_accounts = following_data.get("city_breakdown", {})
    priority_usernames = set()
    for city_users in city_accounts.values():
        priority_usernames.update(city_users)

    # Also include influencers and communities (skip big brands)
    skip_categories = {"pet-brand"}
    all_usernames = []
    for acc in accounts:
        cat = acc.get("category", "")
        base_cat = cat.split("-")[0] + "-" + cat.split("-")[1] if "-" in cat else cat
        if any(skip in cat for skip in skip_categories):
            continue
        all_usernames.append(acc["username"])

    # Prioritize: city-tagged accounts first, then others
    priority_list = [u for u in all_usernames if u in priority_usernames]
    other_list = [u for u in all_usernames if u not in priority_usernames]

    # Batch into groups of 30 (Apify profile scraper limit)
    all_ordered = priority_list + other_list
    batch_size = 30
    batches = [all_ordered[i:i+batch_size] for i in range(0, len(all_ordered), batch_size)]

    print(f"\n🐕 PawCities Engagement Bot — Following Discovery")
    print(f"   Accounts: {len(all_ordered)} (priority: {len(priority_list)}, other: {len(other_list)})")
    print(f"   Batches: {len(batches)} × {batch_size}\n")

    all_posts = []

    for batch_num, batch_usernames in enumerate(batches, 1):
        print(f"  📦 Batch {batch_num}/{len(batches)}: {len(batch_usernames)} accounts...")

        # Use Instagram Profile Scraper to get recent posts
        result = apify_request("POST", "/acts/apify~instagram-profile-scraper/runs", {
            "usernames": batch_usernames,
            "resultsLimit": 3,  # Last 3 posts per account
        })

        if result and result.get("data", {}).get("id"):
            run_id = result["data"]["id"]
            dataset_id = result["data"]["defaultDatasetId"]
            print(f"    ✅ Run {run_id} started")

            # Wait for completion
            status = None
            for _ in range(30):
                time.sleep(10)
                status = apify_request("GET", f"/actor-runs/{run_id}")
                run_status = status.get("data", {}).get("status", "") if status else ""
                if run_status in ("SUCCEEDED", "FAILED", "ABORTED"):
                    break
                print("    ⏳ Still running...")

            run_status = status.get("data", {}).get("status") if status else "UNKNOWN"
            if run_status == "SUCCEEDED":
                items = apify_request("GET", f"/datasets/{dataset_id}/items?limit=500")
                if items and isinstance(items, list):
                    # Profile scraper returns profile objects with latestPosts
                    post_count = 0
                    for profile in items:
                        username = profile.get("username", "")
                        latest_posts = profile.get("latestPosts", [])
                        for post in latest_posts:
                            post["ownerUsername"] = username
                            post["_discovered_at"] = datetime.now(timezone.utc).isoformat()
                            post["_source"] = "following"
                            # Try to detect city from our city_breakdown
                            post["_city"] = None
                            for city_slug, city_users in city_accounts.items():
                                if username in city_users:
                                    post["_city"] = city_slug
                                    break
                            all_posts.append(post)
                            post_count += 1
                    print(f"    📦 Got {post_count} posts from {len(items)} profiles")
                else:
                    print(f"    ⚠️ No items returned")
            else:
                print(f"    ❌ Run ended with status: {run_status}")
        else:
            print(f"    ❌ Failed to start scraper")

        # Delay between batches
        time.sleep(5)

    # Filter and normalize posts (same logic as hashtag discovery)
    min_likes = config["discovery"]["min_likes"]
    max_age = config["discovery"]["max_age_days"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age)

    history = load_history()
    commented_post_ids = {h["post_id"] for h in history}

    filtered = []
    seen_ids = set()

    for post in all_posts:
        post_id = post.get("id", "") or post.get("shortCode", "")
        if not post_id or post_id in seen_ids or post_id in commented_post_ids:
            continue
        seen_ids.add(post_id)

        if (post.get("likesCount") or 0) < min_likes:
            continue

        try:
            ts = post.get("timestamp", "") or ""
            if ts:
                post_date = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if post_date < cutoff:
                    continue
        except (ValueError, TypeError):
            pass

        caption = post.get("caption", "") or ""
        hashtags = post.get("hashtags", [])
        location = post.get("locationName", "")
        city_slug = post.get("_city") or detect_city(caption, hashtags, location)

        filtered.append({
            "id": post_id,
            "shortcode": post.get("shortCode", ""),
            "ownerUsername": post.get("ownerUsername", ""),
            "ownerId": post.get("ownerId", ""),
            "caption": caption[:500],
            "hashtags": hashtags,
            "mentions": post.get("mentions", []),
            "locationName": location,
            "likesCount": post.get("likesCount", 0),
            "commentsCount": post.get("commentsCount", 0),
            "timestamp": post.get("timestamp"),
            "url": post.get("url", f"https://www.instagram.com/p/{post.get('shortCode', '')}/"),
            "displayUrl": post.get("displayUrl", ""),
            "city": city_slug,
            "discoveredAt": post.get("_discovered_at"),
            "source": "following",
        })

    filtered.sort(key=lambda p: p.get("likesCount", 0), reverse=True)

    # Merge with existing discovered posts (don't overwrite, append)
    existing_posts = []
    if POSTS_FILE.exists():
        with open(POSTS_FILE) as f:
            existing_data = json.load(f)
            existing_posts = existing_data.get("posts", [])

    existing_ids = {p["id"] for p in existing_posts}
    new_posts = [p for p in filtered if p["id"] not in existing_ids]

    merged = existing_posts + new_posts
    merged.sort(key=lambda p: p.get("likesCount", 0), reverse=True)

    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "total_raw": len(all_posts),
        "total_filtered": len(filtered),
        "total_new": len(new_posts),
        "total_merged": len(merged),
        "posts": merged,
    }
    with open(POSTS_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n  📊 Following discovery complete:")
    print(f"     Scraped: {len(all_posts)} posts from {len(all_ordered)} accounts")
    print(f"     Eligible: {len(filtered)} | New (not in queue): {len(new_posts)}")
    print(f"     Total in pool: {len(merged)}")
    print(f"  💾 Merged into {POSTS_FILE}\n")

    for i, p in enumerate(new_posts[:5]):
        print(f"  {i+1}. @{p['ownerUsername']} | {p['likesCount']}❤️ | {p['city'] or '?'}")
        print(f"     {(p['caption'] or '')[:80]}...")
        print(f"     {p['url']}\n")

    return output


# ─── Queue Management ────────────────────────────────────────────────────────

def load_queue():
    if QUEUE_FILE.exists():
        with open(QUEUE_FILE) as f:
            return json.load(f)
    return {"items": [], "stats": {"generated": 0, "posted": 0, "failed": 0, "skipped": 0}}


def save_queue(queue):
    with open(QUEUE_FILE, "w") as f:
        json.dump(queue, f, indent=2)


def load_history():
    if HISTORY_FILE.exists():
        with open(HISTORY_FILE) as f:
            data = json.load(f)
            return data.get("comments", [])
    return []


def save_history(comments):
    with open(HISTORY_FILE, "w") as f:
        json.dump({"comments": comments, "updated": datetime.now(timezone.utc).isoformat()}, f, indent=2)


def generate_queue():
    """Generate comments for discovered posts and add to queue."""
    config = load_config()

    if not POSTS_FILE.exists():
        print("No discovered posts found. Run 'discover' first.")
        return

    with open(POSTS_FILE) as f:
        discovery = json.load(f)

    posts = discovery.get("posts", [])
    if not posts:
        print("No posts to generate comments for.")
        return

    queue = load_queue()
    history = load_history()

    # Track what we've already queued or commented on
    existing_post_ids = {item["post_id"] for item in queue["items"]}
    commented_post_ids = {h["post_id"] for h in history}

    # Also track recent comment hashes to avoid repetitive phrasing
    recent_hashes = {item.get("comment_hash") for item in queue["items"][-100:]}

    new_count = 0
    for post in posts:
        post_id = post["id"]
        if post_id in existing_post_ids or post_id in commented_post_ids:
            continue

        comment_data = generate_comment(post, config)

        # Retry if we got a duplicate hash
        attempts = 0
        while comment_data["hash"] in recent_hashes and attempts < 5:
            comment_data = generate_comment(post, config)
            attempts += 1

        queue_item = {
            "id": f"cmt-{int(time.time()*1000)}-{random.randint(100,999)}",
            "post_id": post_id,
            "post_shortcode": post.get("shortcode", ""),
            "post_url": post.get("url", ""),
            "target_username": post.get("ownerUsername", ""),
            "post_likes": post.get("likesCount", 0),
            "city": post.get("city"),
            "comment_text": comment_data["text"],
            "comment_category": comment_data["category"],
            "comment_language": comment_data["language"],
            "comment_hash": comment_data["hash"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "posted_at": None,
            "error": None,
        }

        queue["items"].append(queue_item)
        queue["stats"]["generated"] += 1
        recent_hashes.add(comment_data["hash"])
        new_count += 1

    save_queue(queue)
    pending = sum(1 for item in queue["items"] if item["status"] == "pending")
    print(f"\n🐕 Generated {new_count} new comments")
    print(f"   Queue: {pending} pending | {queue['stats']['posted']} posted | {queue['stats']['failed']} failed\n")

    # Preview first 5
    pending_items = [item for item in queue["items"] if item["status"] == "pending"]
    for item in pending_items[:5]:
        print(f"  → @{item['target_username']} ({item['post_likes']}❤️)")
        print(f"    \"{item['comment_text']}\"")
        print(f"    [{item['comment_category']}] [{item['comment_language']}]\n")


def show_queue():
    """Show queue status."""
    queue = load_queue()
    pending = [i for i in queue["items"] if i["status"] == "pending"]
    posted = [i for i in queue["items"] if i["status"] == "posted"]
    failed = [i for i in queue["items"] if i["status"] == "failed"]

    print(f"\n🐕 Comment Queue Status")
    print(f"   Pending:  {len(pending)}")
    print(f"   Posted:   {len(posted)}")
    print(f"   Failed:   {len(failed)}")
    print(f"   Total:    {len(queue['items'])}\n")

    if pending:
        print(f"  Next 5 in queue:\n")
        for item in pending[:5]:
            print(f"  → @{item['target_username']} | {item['city'] or '?'} | {item['post_likes']}❤️")
            print(f"    \"{item['comment_text'][:80]}...\"")
            print(f"    {item['post_url']}\n")

    # Today's stats
    today = datetime.now(timezone.utc).date().isoformat()
    today_posted = sum(1 for i in posted if i.get("posted_at", "").startswith(today))
    config = load_config()
    print(f"  📊 Today: {today_posted}/{config['daily_cap']} comments posted\n")


# ─── Instagram Execution ─────────────────────────────────────────────────────

# Module-level client reference for session reuse + re-auth
_ig_client = None
_ig_reauth_count = 0
MAX_REAUTH_ATTEMPTS = 2

def get_ig_client(force_fresh=False):
    """Get or create an authenticated Instagram client.

    Caches the client at module level so re-auth can happen mid-run.
    Set force_fresh=True to delete the old session and start clean.
    """
    global _ig_client, _ig_reauth_count
    from instagrapi import Client

    if _ig_client is not None and not force_fresh:
        return _ig_client

    cl = Client()

    # Set proxy if provided
    proxy = os.environ.get("IG_PROXY")
    if proxy:
        cl.set_proxy(proxy)

    username = os.environ.get("IG_USERNAME")
    password = os.environ.get("IG_PASSWORD")
    if not username or not password:
        print("ERROR: IG_USERNAME and IG_PASSWORD environment variables required")
        sys.exit(1)

    # Try to load existing session (skip if forcing fresh)
    if SESSION_FILE.exists() and not force_fresh:
        try:
            cl.load_settings(str(SESSION_FILE))
            cl.login(username, password)
            print("  ✅ Loaded existing session")
            _ig_client = cl
            return cl
        except Exception as e:
            print(f"  ⚠️ Session expired, re-authenticating: {e}")

    # Fresh login — delete stale session first
    if SESSION_FILE.exists() and force_fresh:
        SESSION_FILE.unlink()
        print("  🗑️  Deleted stale session file")

    cl = Client()  # fresh instance to avoid cached state
    if proxy:
        cl.set_proxy(proxy)

    cl.login(username, password)
    cl.dump_settings(str(SESSION_FILE))
    print("  ✅ Fresh login successful — session saved")
    _ig_client = cl
    _ig_reauth_count = 0
    return cl


def reauth_ig_client():
    """Force a fresh re-authentication. Called when login_required is detected mid-run."""
    global _ig_client, _ig_reauth_count
    _ig_reauth_count += 1

    if _ig_reauth_count > MAX_REAUTH_ATTEMPTS:
        print(f"\n  🚨 Re-auth failed {_ig_reauth_count} times — session may be permanently blocked.")
        print(f"     Try manually: python3 agents/engagement-bot.py login")
        return None

    print(f"\n  🔄 Session expired mid-run — attempting re-authentication (attempt {_ig_reauth_count}/{MAX_REAUTH_ATTEMPTS})...")
    try:
        _ig_client = None
        cl = get_ig_client(force_fresh=True)
        # Verify the session actually works
        cl.account_info()
        print(f"  ✅ Re-authentication successful!")
        return cl
    except Exception as e:
        print(f"  ❌ Re-authentication failed: {e}")
        _ig_client = None
        return None


def is_login_error(error_str):
    """Check if an error indicates the session has expired."""
    login_keywords = [
        "login_required",
        "LoginRequired",
        "Please wait a few minutes",
        "checkpoint_required",
        "two_factor_required",
    ]
    return any(kw.lower() in error_str.lower() for kw in login_keywords)


def do_login():
    """Interactive login setup."""
    print("\n🐕 Instagram Login Setup\n")
    cl = get_ig_client()
    info = cl.account_info()
    print(f"  Logged in as: @{info.username}")
    # Attribute names vary across instagrapi versions
    followers = getattr(info, 'follower_count', None) or getattr(info, 'followers_count', None) or '?'
    following = getattr(info, 'following_count', None) or getattr(info, 'followings_count', None) or '?'
    print(f"  Followers: {followers}")
    print(f"  Following: {following}")
    print(f"  Session saved to: {SESSION_FILE}\n")


def execute_comments(dry_run=False, limit=None):
    """Execute pending comments from the queue."""
    config = load_config()
    queue = load_queue()
    history = load_history()

    pending = [i for i in queue["items"] if i["status"] == "pending"]
    if not pending:
        print("No pending comments in queue. Run 'generate' first.")
        return

    # Check daily cap
    today = datetime.now(timezone.utc).date().isoformat()
    today_posted = sum(1 for i in queue["items"] if i["status"] == "posted" and (i.get("posted_at") or "").startswith(today))
    daily_cap = config["daily_cap"]
    remaining_today = daily_cap - today_posted

    if remaining_today <= 0 and not dry_run:
        print(f"  ⛔ Daily cap reached ({daily_cap}/{daily_cap}). Try again tomorrow.")
        return

    # Respect limit
    batch_count = min(len(pending), remaining_today)
    if limit:
        batch_count = min(batch_count, limit)

    print(f"\n🐕 Engagement Bot — {'DRY RUN' if dry_run else 'EXECUTING'}")
    print(f"   Pending: {len(pending)} | Today: {today_posted}/{daily_cap} | This batch: {batch_count}\n")

    if not dry_run:
        cl = get_ig_client()
    else:
        cl = None

    timing = config["timing"]
    posted_in_batch = 0
    total_posted = 0

    for item in pending[:batch_count]:
        # Batch break
        if posted_in_batch >= timing["batch_size"]:
            break_time = random.randint(timing["batch_break_min_seconds"], timing["batch_break_max_seconds"])
            print(f"\n  ☕ Batch break: {break_time}s ({posted_in_batch} comments sent)...\n")
            if not dry_run:
                time.sleep(break_time)
            posted_in_batch = 0

        print(f"  {'📝' if dry_run else '💬'} @{item['target_username']} | {item['comment_text'][:60]}...")

        if dry_run:
            item["status"] = "dry_run"
            total_posted += 1
        else:
            try:
                # Get the media PK from shortcode
                media_pk = cl.media_pk_from_code(item["post_shortcode"])
                comment_obj = cl.media_comment(media_pk, item["comment_text"])

                # Extract comment ID for reply tracking
                comment_pk = str(getattr(comment_obj, 'pk', '')) if comment_obj else ''

                item["status"] = "posted"
                item["posted_at"] = datetime.now(timezone.utc).isoformat()
                item["comment_pk"] = comment_pk
                item["media_pk"] = str(media_pk)
                queue["stats"]["posted"] += 1

                history.append({
                    "post_id": item["post_id"],
                    "post_url": item["post_url"],
                    "post_shortcode": item["post_shortcode"],
                    "target_username": item["target_username"],
                    "comment_text": item["comment_text"],
                    "city": item["city"],
                    "posted_at": item["posted_at"],
                    "comment_pk": comment_pk,
                    "media_pk": str(media_pk),
                    "reply_checked_at": None,
                    "replies": [],
                })

                total_posted += 1
                posted_in_batch += 1
                print(f"     ✅ Posted")

            except Exception as e:
                error_str = str(e)

                # If we get an action block, stop immediately
                if "action_block" in error_str.lower() or "challenge" in error_str.lower():
                    item["status"] = "failed"
                    item["error"] = error_str[:200]
                    queue["stats"]["failed"] += 1
                    print(f"     ❌ Failed: {error_str[:100]}")
                    print(f"\n  🚨 ACTION BLOCK DETECTED — stopping immediately.")
                    print(f"     Wait 24-48 hours before retrying.\n")
                    break

                # Session expired mid-run — try to re-authenticate
                if is_login_error(error_str):
                    print(f"     ⚠️ Session expired: {error_str[:80]}")
                    # Don't mark as failed — keep as pending for retry
                    cl = reauth_ig_client()
                    if cl is None:
                        # Re-auth failed, stop the batch
                        print(f"\n  🚨 Cannot re-authenticate — stopping batch.")
                        print(f"     Run: python3 agents/engagement-bot.py login\n")
                        break
                    # Retry this item after re-auth
                    try:
                        media_pk = cl.media_pk_from_code(item["post_shortcode"])
                        comment_obj = cl.media_comment(media_pk, item["comment_text"])
                        comment_pk = str(getattr(comment_obj, 'pk', '')) if comment_obj else ''

                        item["status"] = "posted"
                        item["posted_at"] = datetime.now(timezone.utc).isoformat()
                        item["comment_pk"] = comment_pk
                        item["media_pk"] = str(media_pk)
                        queue["stats"]["posted"] += 1

                        history.append({
                            "post_id": item["post_id"],
                            "post_url": item["post_url"],
                            "post_shortcode": item["post_shortcode"],
                            "target_username": item["target_username"],
                            "comment_text": item["comment_text"],
                            "city": item["city"],
                            "posted_at": item["posted_at"],
                            "comment_pk": comment_pk,
                            "media_pk": str(media_pk),
                            "reply_checked_at": None,
                            "replies": [],
                        })

                        total_posted += 1
                        posted_in_batch += 1
                        print(f"     ✅ Posted (after re-auth)")
                    except Exception as retry_err:
                        item["status"] = "failed"
                        item["error"] = str(retry_err)[:200]
                        queue["stats"]["failed"] += 1
                        print(f"     ❌ Retry failed: {str(retry_err)[:100]}")
                else:
                    # Non-session error (content issue, deleted post, etc.)
                    item["status"] = "failed"
                    item["error"] = error_str[:200]
                    queue["stats"]["failed"] += 1
                    print(f"     ❌ Failed: {error_str[:100]}")

        # Random delay between comments
        if not dry_run and total_posted < batch_count:
            delay = random.randint(timing["min_delay_seconds"], timing["max_delay_seconds"])
            print(f"     ⏳ Waiting {delay}s...")
            time.sleep(delay)

    # Reset items that failed due to session issues back to pending
    session_reset_count = 0
    for item in queue["items"]:
        if item["status"] == "failed" and item.get("error") and is_login_error(item["error"]):
            item["status"] = "pending"
            item["error"] = None
            queue["stats"]["failed"] = max(0, queue["stats"]["failed"] - 1)
            session_reset_count += 1
    if session_reset_count > 0:
        print(f"\n  ♻️ Reset {session_reset_count} session-failed items back to pending")

    save_queue(queue)
    save_history(history)

    print(f"\n  📊 Batch complete: {total_posted} {'previewed' if dry_run else 'posted'}")
    print(f"     Today total: {today_posted + (total_posted if not dry_run else 0)}/{daily_cap}\n")


def test_comment():
    """Post a single test comment to verify the setup works."""
    print("\n🐕 Test Mode — posting one comment\n")
    cl = get_ig_client()

    # Comment on a PawCities post (our own) as a safe test
    test_shortcode = "REPLACE_WITH_YOUR_POST_SHORTCODE"
    test_comment = f"Test comment from engagement bot at {datetime.now().strftime('%H:%M:%S')} 🐾"

    print(f"  Posting: \"{test_comment}\"")
    print(f"  To: https://instagram.com/p/{test_shortcode}/")

    try:
        media_pk = cl.media_pk_from_code(test_shortcode)
        cl.media_comment(media_pk, test_comment)
        print(f"  ✅ Test comment posted successfully!\n")
    except Exception as e:
        print(f"  ❌ Failed: {e}\n")


def reset_session_failures():
    """Reset items that failed due to session/login errors back to pending.
    Use this after a session expires and you've re-authenticated."""
    queue = load_queue()

    session_errors = ["login_required", "loginrequired", "please wait a few minutes",
                      "checkpoint_required"]
    reset_count = 0

    for item in queue["items"]:
        if item["status"] == "failed" and item.get("error"):
            if any(kw in item["error"].lower() for kw in session_errors):
                item["status"] = "pending"
                item["error"] = None
                queue["stats"]["failed"] = max(0, queue["stats"]["failed"] - 1)
                reset_count += 1

    if reset_count > 0:
        save_queue(queue)
        print(f"\n  ♻️ Reset {reset_count} session-failed items back to pending")
        print(f"  Now run: python3 agents/engagement-bot.py login")
        print(f"  Then:    python3 agents/engagement-bot.py run --limit {reset_count}\n")
    else:
        print(f"\n  No session-failed items found in queue.\n")


# ─── Statistics ──────────────────────────────────────────────────────────────

def show_stats():
    """Show engagement statistics."""
    history = load_history()
    queue = load_queue()

    if not history:
        print("\nNo engagement history yet. Run the bot first.\n")
        return

    print(f"\n🐕 Engagement Statistics\n")
    print(f"  Total comments posted: {len(history)}")

    # By city
    city_counts = {}
    for h in history:
        city = h.get("city") or "unknown"
        city_counts[city] = city_counts.get(city, 0) + 1

    print(f"\n  By city:")
    for city, count in sorted(city_counts.items(), key=lambda x: -x[1]):
        bar = "█" * min(count, 40)
        print(f"    {city:20s} {count:4d} {bar}")

    # By day
    day_counts = {}
    for h in history:
        day = (h.get("posted_at") or "")[:10]
        if day:
            day_counts[day] = day_counts.get(day, 0) + 1

    if day_counts:
        print(f"\n  By day (last 7):")
        for day in sorted(day_counts.keys())[-7:]:
            count = day_counts[day]
            bar = "█" * min(count, 40)
            print(f"    {day} {count:4d} {bar}")

    # Unique accounts reached
    unique_accounts = {h["target_username"] for h in history}
    print(f"\n  Unique accounts reached: {len(unique_accounts)}")

    # Queue health
    pending = sum(1 for i in queue["items"] if i["status"] == "pending")
    print(f"  Pending in queue: {pending}")

    # Reply stats
    replies_file = ENGAGEMENT_DIR / "reply-tracker.json"
    if replies_file.exists():
        with open(replies_file) as f:
            reply_data = json.load(f)
        total_replies = sum(len(c.get("replies", [])) for c in reply_data.get("comments", []))
        awaiting = sum(1 for c in reply_data.get("comments", [])
                       for r in c.get("replies", []) if r.get("status") == "pending")
        responded = sum(1 for c in reply_data.get("comments", [])
                        for r in c.get("replies", []) if r.get("status") == "responded")
        followed = len(reply_data.get("followed_back", []))
        print(f"  Replies received: {total_replies}")
        print(f"  Awaiting re-engagement: {awaiting}")
        print(f"  Re-engagements sent: {responded}")
        print(f"  Follow-backs executed: {followed}")

    print()


# ─── Reply Monitoring ────────────────────────────────────────────────────────

REPLY_TRACKER_FILE = ENGAGEMENT_DIR / "reply-tracker.json"

def load_reply_tracker():
    if REPLY_TRACKER_FILE.exists():
        with open(REPLY_TRACKER_FILE) as f:
            return json.load(f)
    return {"comments": [], "followed_back": [], "stats": {"total_replies": 0, "total_re_engagements": 0}}

def save_reply_tracker(data):
    with open(REPLY_TRACKER_FILE, "w") as f:
        json.dump(data, f, indent=2)


def backfill_comment_ids(max_posts=50):
    """Backfill comment_pk and media_pk for comments posted before tracking was added.
    Looks up our comments on each post and matches by text."""

    print(f"\n🔧 Backfilling comment IDs for reply tracking\n")

    history = load_history()
    our_username = os.environ.get("IG_USERNAME", "thepawcities").lower()

    # Find entries missing comment_pk
    missing = [h for h in history if not h.get("comment_pk")]
    if not missing:
        print("  All comments already have tracking IDs. Nothing to backfill.\n")
        return

    print(f"  {len(missing)} comments need backfilling (checking up to {max_posts})...\n")

    cl = get_ig_client()
    backfilled = 0
    errors = 0

    for i, entry in enumerate(missing[:max_posts]):
        shortcode = entry.get("post_shortcode", "")
        if not shortcode:
            # Try to extract from post_url
            url = entry.get("post_url", "")
            if "/p/" in url:
                shortcode = url.split("/p/")[1].strip("/").split("/")[0]
            elif "/reel/" in url:
                shortcode = url.split("/reel/")[1].strip("/").split("/")[0]

        if not shortcode:
            print(f"  ⚠️  @{entry.get('target_username','?')} — no shortcode, skipping")
            errors += 1
            continue

        try:
            media_pk = cl.media_pk_from_code(shortcode)
            comments = cl.media_comments(media_pk, amount=30)

            # Find our comment by matching text
            our_text = entry.get("comment_text", "").strip()
            matched = None
            for c in comments:
                c_user = getattr(c, 'user', None)
                c_username = getattr(c_user, 'username', '').lower() if c_user else ''
                c_text = getattr(c, 'text', '').strip()

                if c_username == our_username and c_text == our_text:
                    matched = c
                    break

            if matched:
                entry["comment_pk"] = str(getattr(matched, 'pk', ''))
                entry["media_pk"] = str(media_pk)
                entry["post_shortcode"] = shortcode
                entry["reply_checked_at"] = None
                entry["replies"] = []
                backfilled += 1
                print(f"  ✅ @{entry['target_username']} — found (pk: {entry['comment_pk'][:12]}...)")
            else:
                # Comment may have been deleted or not found in top 30
                entry["media_pk"] = str(media_pk)
                entry["post_shortcode"] = shortcode
                print(f"  ⚠️  @{entry['target_username']} — comment not found in top 30")

            # Gentle delay
            if i < len(missing[:max_posts]) - 1:
                time.sleep(random.randint(2, 5))

        except Exception as e:
            error_str = str(e)
            if is_login_error(error_str):
                print(f"  ⚠️ Session expired: {error_str[:80]}")
                cl = reauth_ig_client()
                if cl is None:
                    print(f"\n  🚨 Cannot re-authenticate — stopping backfill.\n")
                    break
                continue  # retry
            errors += 1
            print(f"  ❌ @{entry.get('target_username','?')} — {error_str[:60]}")

    save_history(history)
    print(f"\n  📊 Backfill complete: {backfilled} recovered, {errors} errors\n")


def monitor_replies(max_check=50):
    """Check posted comments for replies. This is how we find warm leads."""
    from instagrapi import Client as IgClient

    print(f"\n🔔 PawCities Reply Monitor\n")

    history = load_history()
    tracker = load_reply_tracker()

    # Build a lookup of already-tracked comment PKs
    tracked_pks = {c["comment_pk"] for c in tracker["comments"] if c.get("comment_pk")}

    # Find comments with comment_pk that we can check (from recent history)
    # Only check comments from the last 14 days (replies older than that are unlikely)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    checkable = [
        h for h in history
        if h.get("comment_pk") and h.get("media_pk")
        and (h.get("posted_at", "") > cutoff)
    ]

    if not checkable:
        print("  No comments with tracking IDs found.")
        print("  Comments posted from now on will be tracked for replies.")
        print("  (Older comments without comment_pk can't be monitored)\n")
        return

    # Sort by oldest-checked first (prioritize comments we haven't checked recently)
    # Comments with no reply_checked_at get top priority
    def check_priority(h):
        rca = h.get("reply_checked_at")
        if not rca:
            return "0000"
        return rca
    checkable.sort(key=check_priority)
    batch = checkable[:max_check]

    print(f"  Checking {len(batch)} comments for replies (of {len(checkable)} trackable)...\n")

    cl = get_ig_client()
    our_username = os.environ.get("IG_USERNAME", "thepawcities").lower()

    new_replies_total = 0

    for i, comment_entry in enumerate(batch):
        try:
            media_pk = int(comment_entry["media_pk"])
            our_comment_pk = int(comment_entry["comment_pk"])

            # Get comment thread (replies to our comment)
            try:
                replies = cl.media_comment_replies(media_pk, our_comment_pk)
            except Exception:
                # Some instagrapi versions use different method name
                try:
                    # Fallback: get all comments on the post and filter
                    all_comments = cl.media_comments(media_pk, amount=50)
                    replies = [
                        c for c in all_comments
                        if getattr(c, 'parent_id', None) == our_comment_pk
                        or (getattr(c, 'replied_to_comment_id', None) == our_comment_pk)
                    ]
                except Exception:
                    replies = []

            # Filter out our own replies
            new_replies = []
            for r in replies:
                reply_pk = str(getattr(r, 'pk', ''))
                reply_username = getattr(r, 'user', None)
                if reply_username:
                    reply_username = getattr(reply_username, 'username', str(reply_username))
                else:
                    reply_username = 'unknown'

                # Skip our own replies
                if reply_username.lower() == our_username:
                    continue

                new_replies.append({
                    "reply_pk": reply_pk,
                    "username": reply_username,
                    "text": getattr(r, 'text', ''),
                    "created_at": str(getattr(r, 'created_at_utc', getattr(r, 'created_at', ''))),
                    "status": "pending",  # pending → queued → responded
                })

            # Update or create tracker entry
            existing = None
            for c in tracker["comments"]:
                if c.get("comment_pk") == comment_entry["comment_pk"]:
                    existing = c
                    break

            if existing is None:
                existing = {
                    "comment_pk": comment_entry["comment_pk"],
                    "media_pk": comment_entry["media_pk"],
                    "post_url": comment_entry.get("post_url", ""),
                    "post_shortcode": comment_entry.get("post_shortcode", ""),
                    "target_username": comment_entry["target_username"],
                    "our_comment": comment_entry["comment_text"],
                    "city": comment_entry.get("city", ""),
                    "posted_at": comment_entry.get("posted_at", ""),
                    "replies": [],
                    "reply_checked_at": None,
                }
                tracker["comments"].append(existing)

            # Add only new replies (not already tracked)
            existing_reply_pks = {r["reply_pk"] for r in existing["replies"]}
            for r in new_replies:
                if r["reply_pk"] and r["reply_pk"] not in existing_reply_pks:
                    existing["replies"].append(r)
                    new_replies_total += 1

            existing["reply_checked_at"] = datetime.now(timezone.utc).isoformat()

            # Also update history entry
            comment_entry["reply_checked_at"] = existing["reply_checked_at"]

            if new_replies:
                print(f"  💬 @{comment_entry['target_username']} — {len(new_replies)} new repl{'y' if len(new_replies)==1 else 'ies'}!")
                for r in new_replies:
                    print(f"     ↳ @{r['username']}: {r['text'][:80]}")

            # Small delay to avoid rate limits
            if i < len(batch) - 1:
                time.sleep(random.randint(2, 5))

        except Exception as e:
            error_str = str(e)
            if is_login_error(error_str):
                print(f"  ⚠️ Session expired: {error_str[:80]}")
                cl = reauth_ig_client()
                if cl is None:
                    print(f"\n  🚨 Cannot re-authenticate — stopping monitor.\n")
                    break
                continue  # retry
            print(f"  ⚠️  Error checking @{comment_entry.get('target_username','?')}: {error_str[:80]}")
            continue

    # Update stats
    tracker["stats"]["total_replies"] = sum(
        len(c.get("replies", [])) for c in tracker["comments"]
    )

    save_reply_tracker(tracker)
    save_history(history)

    # Summary
    pending_replies = sum(
        1 for c in tracker["comments"]
        for r in c.get("replies", []) if r["status"] == "pending"
    )

    print(f"\n  📊 Reply monitoring complete:")
    print(f"     Comments checked: {len(batch)}")
    print(f"     New replies found: {new_replies_total}")
    print(f"     Total pending re-engagement: {pending_replies}\n")


# ─── Re-engagement Generator ─────────────────────────────────────────────────

RE_ENGAGEMENT_TEMPLATES = {
    "thanks": [
        "Thank you so much! We're always looking for great spots to share with dog owners 🐾",
        "Thanks! We love connecting with fellow dog lovers 💛",
        "Appreciate it! Your pup is adorable by the way 🐕",
        "That means a lot! We're building a community of dog-friendly spots at pawcities.com 🧡",
    ],
    "answer_question": [
        "Great question! We actually cover tips like this on pawcities.com — check it out! 🐾",
        "We've been there a few times — always a great experience with dogs!",
        "Totally! It's one of the best spots we've found. Dog owners love it 💛",
    ],
    "enthusiastic": [
        "Right?! So many amazing dog-friendly places to discover! Follow us for more 🐾",
        "We're so glad you agree! We share spots like this every week 🐕",
        "YES! That's exactly what we think too. Dog owners deserve great resources 💛",
    ],
    "local_tip": [
        "If you love this spot, there are so many more to discover! Check pawcities.com for {city_ref} 🐾",
        "Great taste! We've mapped tons of dog-friendly gems in {city_ref}at pawcities.com 🧡",
    ],
    "follow_invite": [
        "So glad you liked it! Follow us for daily dog-friendly discoveries 🐾",
        "Thanks for the love! We share spots like this across 8 cities — follow along! 🐕",
    ],
}

RE_ENGAGEMENT_QUEUE_FILE = ENGAGEMENT_DIR / "re-engagement-queue.json"

def load_re_engagement_queue():
    if RE_ENGAGEMENT_QUEUE_FILE.exists():
        with open(RE_ENGAGEMENT_QUEUE_FILE) as f:
            return json.load(f)
    return {"items": [], "stats": {"generated": 0, "posted": 0, "failed": 0}}

def save_re_engagement_queue(data):
    with open(RE_ENGAGEMENT_QUEUE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def generate_re_engagements():
    """Generate reply responses for people who replied to our comments."""
    print(f"\n🔄 PawCities Re-engagement Generator\n")

    tracker = load_reply_tracker()
    re_queue = load_re_engagement_queue()
    config = load_config()

    # Find all pending replies that need responses
    pending_replies = []
    for comment in tracker["comments"]:
        for reply in comment.get("replies", []):
            if reply["status"] == "pending":
                pending_replies.append((comment, reply))

    if not pending_replies:
        print("  No pending replies to respond to.\n")
        return

    print(f"  Found {len(pending_replies)} replies awaiting re-engagement\n")

    # Already queued reply PKs
    already_queued = {item.get("reply_pk") for item in re_queue["items"]}

    generated = 0
    for comment, reply in pending_replies:
        if reply["reply_pk"] in already_queued:
            reply["status"] = "queued"
            continue

        # Classify the reply to pick the right template category
        reply_text = reply["text"].lower()
        if any(w in reply_text for w in ["thank", "thanks", "thx", "love this", "so true", "agree", "❤", "🙏", "💛", "🔥"]):
            category = "enthusiastic"
        elif "?" in reply["text"]:
            category = "answer_question"
        elif any(w in reply_text for w in ["follow", "check", "profile", "page"]):
            category = "follow_invite"
        elif comment.get("city"):
            category = "local_tip"
        else:
            category = "thanks"

        templates = RE_ENGAGEMENT_TEMPLATES.get(category, RE_ENGAGEMENT_TEMPLATES["thanks"])
        template = random.choice(templates)

        # Fill city reference
        city_slug = comment.get("city", "")
        city_name = config.get("cities", {}).get(city_slug, {}).get("name", "")
        city_ref = f"{city_name} " if city_name else ""
        response_text = template.replace("{city_ref}", city_ref)

        # Add to re-engagement queue
        re_queue["items"].append({
            "reply_pk": reply["reply_pk"],
            "comment_pk": comment["comment_pk"],
            "media_pk": comment["media_pk"],
            "post_url": comment.get("post_url", ""),
            "post_shortcode": comment.get("post_shortcode", ""),
            "replier_username": reply["username"],
            "reply_text": reply["text"],
            "our_original_comment": comment["our_comment"],
            "target_username": comment["target_username"],
            "response_text": response_text,
            "category": category,
            "city": city_slug,
            "status": "pending",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })

        reply["status"] = "queued"
        generated += 1

        print(f"  ↳ @{reply['username']}: \"{reply['text'][:50]}\"")
        print(f"    → \"{response_text[:60]}\" [{category}]")

    re_queue["stats"]["generated"] += generated
    save_re_engagement_queue(re_queue)
    save_reply_tracker(tracker)

    print(f"\n  📊 Generated {generated} re-engagement responses")
    print(f"     Queue total: {sum(1 for i in re_queue['items'] if i['status']=='pending')} pending\n")


def execute_re_engagements(limit=20):
    """Post re-engagement replies to people who replied to our comments."""
    print(f"\n🔄 PawCities Re-engagement — EXECUTING\n")

    re_queue = load_re_engagement_queue()
    tracker = load_reply_tracker()

    pending = [i for i in re_queue["items"] if i["status"] == "pending"]
    if not pending:
        print("  No pending re-engagements. Run 'monitor-replies' and 'generate-replies' first.\n")
        return

    batch = pending[:limit]
    print(f"  Executing {len(batch)} re-engagement replies...\n")

    cl = get_ig_client()
    posted = 0

    for item in batch:
        try:
            media_pk = int(item["media_pk"])
            parent_comment_pk = int(item["comment_pk"])

            # Reply to the thread (reply to the person who replied to us)
            try:
                comment_obj = cl.media_comment(
                    media_pk,
                    f"@{item['replier_username']} {item['response_text']}",
                    replied_to_comment_id=parent_comment_pk
                )
            except TypeError:
                # Some instagrapi versions don't support replied_to_comment_id
                comment_obj = cl.media_comment(
                    media_pk,
                    f"@{item['replier_username']} {item['response_text']}"
                )

            item["status"] = "posted"
            item["posted_at"] = datetime.now(timezone.utc).isoformat()
            re_queue["stats"]["posted"] += 1
            posted += 1

            # Update reply status in tracker
            for c in tracker["comments"]:
                if c["comment_pk"] == item["comment_pk"]:
                    for r in c["replies"]:
                        if r["reply_pk"] == item["reply_pk"]:
                            r["status"] = "responded"
                            break

            print(f"  ✅ @{item['replier_username']} — {item['response_text'][:50]}...")

            # Delay between re-engagements (shorter than cold comments — these are warm)
            if posted < len(batch):
                delay = random.randint(30, 75)
                print(f"     ⏳ Waiting {delay}s...")
                time.sleep(delay)

        except Exception as e:
            error_str = str(e)

            if "action_block" in error_str.lower() or "challenge" in error_str.lower():
                item["status"] = "failed"
                item["error"] = error_str[:200]
                re_queue["stats"]["failed"] += 1
                print(f"  ❌ @{item['replier_username']} — {error_str[:80]}")
                print(f"\n  🚨 ACTION BLOCK — stopping re-engagement.\n")
                break

            if is_login_error(error_str):
                print(f"  ⚠️ Session expired: {error_str[:80]}")
                cl = reauth_ig_client()
                if cl is None:
                    print(f"\n  🚨 Cannot re-authenticate — stopping.\n")
                    break
                continue  # retry from the loop — item still pending

            item["status"] = "failed"
            item["error"] = error_str[:200]
            re_queue["stats"]["failed"] += 1
            print(f"  ❌ @{item['replier_username']} — {error_str[:80]}")

    save_re_engagement_queue(re_queue)
    save_reply_tracker(tracker)

    print(f"\n  📊 Re-engagement complete: {posted} sent\n")


# ─── Smart Follow-Back Agent ─────────────────────────────────────────────────

def follow_engaged_accounts(limit=10):
    """Follow accounts that have engaged with us (replied to our comments).
    These are warm leads — they already interacted, so a follow is natural
    and much more likely to result in a follow-back."""

    print(f"\n👥 PawCities Smart Follow-Back\n")

    tracker = load_reply_tracker()
    history = load_history()

    # Collect all unique accounts that replied to us
    replier_accounts = {}
    for comment in tracker["comments"]:
        for reply in comment.get("replies", []):
            username = reply["username"]
            if username not in replier_accounts:
                replier_accounts[username] = {
                    "username": username,
                    "interaction_count": 0,
                    "cities": set(),
                    "latest_reply": "",
                    "sample_reply": "",
                }
            replier_accounts[username]["interaction_count"] += 1
            if comment.get("city"):
                replier_accounts[username]["cities"].add(comment["city"])
            if reply.get("created_at", "") > replier_accounts[username]["latest_reply"]:
                replier_accounts[username]["latest_reply"] = reply["created_at"]
                replier_accounts[username]["sample_reply"] = reply["text"][:100]

    if not replier_accounts:
        print("  No engaged accounts found. Run 'monitor-replies' first.\n")
        return

    # Filter out accounts we've already followed back
    already_followed = set(tracker.get("followed_back", []))
    our_username = os.environ.get("IG_USERNAME", "thepawcities").lower()
    candidates = {
        u: info for u, info in replier_accounts.items()
        if u not in already_followed and u.lower() != our_username
    }

    if not candidates:
        print("  All engaged accounts already followed! 🎉\n")
        return

    # Sort by engagement count (most engaged first)
    sorted_candidates = sorted(
        candidates.values(),
        key=lambda x: (-x["interaction_count"], x["latest_reply"]),
    )
    batch = sorted_candidates[:limit]

    print(f"  {len(candidates)} engaged accounts | Following top {len(batch)}\n")

    cl = get_ig_client()
    followed_count = 0

    for account in batch:
        username = account["username"]
        try:
            # Get user ID from username
            user_info = cl.user_info_by_username(username)
            user_pk = user_info.pk

            # Check if we already follow them
            # (skip the API call if possible — just try to follow)
            cl.user_follow(user_pk)

            tracker.setdefault("followed_back", []).append(username)
            followed_count += 1

            cities_str = ", ".join(account["cities"]) if account["cities"] else "global"
            print(f"  ✅ @{username} ({account['interaction_count']} interactions, {cities_str})")
            print(f"     Last reply: \"{account['sample_reply'][:60]}\"")

            # Delay between follows (be gentle)
            if followed_count < len(batch):
                delay = random.randint(30, 90)
                print(f"     ⏳ Waiting {delay}s...")
                time.sleep(delay)

        except Exception as e:
            error_str = str(e)

            if "action_block" in error_str.lower() or "challenge" in error_str.lower():
                print(f"  ⚠️  @{username}: {error_str[:80]}")
                print(f"\n  🚨 ACTION BLOCK — stopping follow-back.\n")
                break

            if is_login_error(error_str):
                print(f"  ⚠️ Session expired: {error_str[:80]}")
                cl = reauth_ig_client()
                if cl is None:
                    print(f"\n  🚨 Cannot re-authenticate — stopping.\n")
                    break
                continue  # retry from the loop

            print(f"  ⚠️  @{username}: {error_str[:80]}")

    save_reply_tracker(tracker)
    print(f"\n  📊 Follow-back complete: {followed_count} new follows\n")


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PawCities Engagement Bot")
    subparsers = parser.add_subparsers(dest="command")

    # discover
    disc = subparsers.add_parser("discover", help="Find new posts to engage with")
    disc.add_argument("--city", type=str, help="Target a specific city")

    # generate
    subparsers.add_parser("generate", help="Generate comments for discovered posts")

    # queue
    subparsers.add_parser("queue", help="Show queue status")

    # run
    run_p = subparsers.add_parser("run", help="Execute queued comments")
    run_p.add_argument("--dry-run", action="store_true", help="Preview without posting")
    run_p.add_argument("--limit", type=int, help="Max comments to post")

    # stats
    subparsers.add_parser("stats", help="Show engagement statistics")

    # login
    subparsers.add_parser("login", help="Set up Instagram session")

    # test
    subparsers.add_parser("test", help="Post one test comment")

    # discover-following
    subparsers.add_parser("discover-following", help="Discover posts from followed accounts (weekly)")

    # backfill
    bf_p = subparsers.add_parser("backfill", help="Recover comment IDs for older comments")
    bf_p.add_argument("--max", type=int, default=50, help="Max posts to check (default 50)")

    # monitor-replies
    mon_p = subparsers.add_parser("monitor-replies", help="Check posted comments for replies")
    mon_p.add_argument("--max", type=int, default=50, help="Max comments to check (default 50)")

    # generate-replies
    subparsers.add_parser("generate-replies", help="Generate re-engagement responses for replies")

    # reply
    reply_p = subparsers.add_parser("reply", help="Execute re-engagement replies")
    reply_p.add_argument("--limit", type=int, default=20, help="Max replies to send (default 20)")

    # follow-back
    fb_p = subparsers.add_parser("follow-back", help="Follow accounts that engaged with us")
    fb_p.add_argument("--limit", type=int, default=10, help="Max accounts to follow (default 10)")

    subparsers.add_parser("reset-failures", help="Reset session-failed items back to pending")

    args = parser.parse_args()

    if args.command == "discover":
        discover_posts(args.city)
    elif args.command == "generate":
        generate_queue()
    elif args.command == "queue":
        show_queue()
    elif args.command == "run":
        execute_comments(dry_run=args.dry_run, limit=args.limit)
    elif args.command == "stats":
        show_stats()
    elif args.command == "login":
        do_login()
    elif args.command == "test":
        test_comment()
    elif args.command == "discover-following":
        discover_following()
    elif args.command == "backfill":
        backfill_comment_ids(max_posts=args.max)
    elif args.command == "monitor-replies":
        monitor_replies(max_check=args.max)
    elif args.command == "generate-replies":
        generate_re_engagements()
    elif args.command == "reply":
        execute_re_engagements(limit=args.limit)
    elif args.command == "follow-back":
        follow_engaged_accounts(limit=args.limit)
    elif args.command == "reset-failures":
        reset_session_failures()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

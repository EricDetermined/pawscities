#!/usr/bin/env python3
"""
PawCities Engagement Bot

Automated Instagram commenting at scale to build @thepawcities brand presence.
Discovers relevant dog-friendly posts across 8 cities, generates contextual comments,
and executes them via instagrapi with human-like timing patterns.

Architecture:
  1. DISCOVER  - Uses Apify to find relevant posts (hashtags, locations, followed accounts)
  2. GENERATE  - Creates varied, contextual comments (not spam)
  3. QUEUE     - Schedules with randomized delays and daily caps
  4. EXECUTE   - Posts comments via instagrapi with session persistence
  5. TRACK     - Logs everything for the engagement dashboard

Usage:
  python3 engagement-bot.py discover                    # Find new posts to engage with
  python3 engagement-bot.py discover --city tokyo       # Single city
  python3 engagement-bot.py generate                    # Generate comments for discovered posts
  python3 engagement-bot.py queue                       # Show queue status
  python3 engagement-bot.py run                         # Execute queued comments (main loop)
  python3 engagement-bot.py run --dry-run               # Preview without posting
  python3 engagement-bot.py run --limit 10              # Execute N comments then stop
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

def get_ig_client():
    """Get or create an authenticated Instagram client."""
    from instagrapi import Client

    cl = Client()

    # Set proxy if provided
    proxy = os.environ.get("IG_PROXY")
    if proxy:
        cl.set_proxy(proxy)

    # Try to load existing session
    if SESSION_FILE.exists():
        try:
            cl.load_settings(str(SESSION_FILE))
            cl.login(os.environ["IG_USERNAME"], os.environ["IG_PASSWORD"])
            print("  ✅ Loaded existing session")
            return cl
        except Exception as e:
            print(f"  ⚠️ Session expired, re-authenticating: {e}")

    # Fresh login
    username = os.environ.get("IG_USERNAME")
    password = os.environ.get("IG_PASSWORD")
    if not username or not password:
        print("ERROR: IG_USERNAME and IG_PASSWORD environment variables required")
        sys.exit(1)

    cl.login(username, password)
    cl.dump_settings(str(SESSION_FILE))
    print("  ✅ Logged in and session saved")
    return cl


def do_login():
    """Interactive login setup."""
    print("\n🐕 Instagram Login Setup\n")
    cl = get_ig_client()
    info = cl.account_info()
    print(f"  Logged in as: @{info.username}")
    print(f"  Followers: {info.follower_count}")
    print(f"  Following: {info.following_count}")
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
                cl.media_comment(media_pk, item["comment_text"])

                item["status"] = "posted"
                item["posted_at"] = datetime.now(timezone.utc).isoformat()
                queue["stats"]["posted"] += 1

                history.append({
                    "post_id": item["post_id"],
                    "post_url": item["post_url"],
                    "target_username": item["target_username"],
                    "comment_text": item["comment_text"],
                    "city": item["city"],
                    "posted_at": item["posted_at"],
                })

                total_posted += 1
                posted_in_batch += 1
                print(f"     ✅ Posted")

            except Exception as e:
                error_str = str(e)
                item["status"] = "failed"
                item["error"] = error_str[:200]
                queue["stats"]["failed"] += 1
                print(f"     ❌ Failed: {error_str[:100]}")

                # If we get an action block, stop immediately
                if "action_block" in error_str.lower() or "challenge" in error_str.lower():
                    print(f"\n  🚨 ACTION BLOCK DETECTED — stopping immediately.")
                    print(f"     Wait 24-48 hours before retrying.\n")
                    break

        # Random delay between comments
        if not dry_run and total_posted < batch_count:
            delay = random.randint(timing["min_delay_seconds"], timing["max_delay_seconds"])
            print(f"     ⏳ Waiting {delay}s...")
            time.sleep(delay)

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
    print()


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
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

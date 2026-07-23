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
  python3 engagement-bot.py follow-all-followers         # Follow back ALL new followers
  python3 engagement-bot.py follow-all-followers --limit 30 --dry-run  # Preview mode

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
BLOCKLIST_FILE = DATA_DIR / "engagement-blocklist.json"


def load_account_blocklist():
    """Accounts we must never target (lowercase handles, no @)."""
    if BLOCKLIST_FILE.exists():
        try:
            with open(BLOCKLIST_FILE) as f:
                return {k.lower().lstrip("@") for k in json.load(f) if not k.startswith("_")}
        except Exception:
            return set()
    return set()


ACCOUNT_BLOCKLIST = load_account_blocklist()

# Ensure dirs exist
ENGAGEMENT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Config ──────────────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "version": "2.0",
    "daily_cap": 15,
    "ramp_schedule": {
        "week_1": 8,
        "week_2": 12,
        "week_3": 15,
        "week_4": 18,
        "week_5": 20,
        "week_6_plus": 25
    },
    "timing": {
        "min_delay_seconds": 90,
        "max_delay_seconds": 300,
        "batch_size": 4,
        "batch_break_min_seconds": 900,
        "batch_break_max_seconds": 2400,
        "active_hours_start": 7,
        "active_hours_end": 23,
        "session_max_minutes": 90,
        "likes_per_comment_min": 1,
        "likes_per_comment_max": 3,
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
        "Love this! {city_ref}is such a great spot for dogs",
        "This made our day! Nothing better than seeing happy pups out exploring",
        "What a beautiful {place_type}! Your dog looks like they're having the best time",
        "This is exactly why we love {city_ref}— so many dog-friendly gems to discover",
        "Adorable! We're always looking for places like this to share with dog owners",
        "Such a great find! More dog parents need to know about spots like this",
        "Your pup is living the dream! {city_ref}has so many great options for dogs",
        "This looks amazing! We love discovering dog-friendly spots like this",
        "What an incredible spot! Your dog clearly knows how to pick the best places",
        "Absolutely love this vibe. Dog-friendly places like this deserve more recognition",
        "This just brightened our whole feed. Dogs and good vibes go hand in hand",
        "So wholesome! Always makes our day to see dogs enjoying new places",
        "The look on your pup's face is priceless. What a great spot",
        "Can't get over how happy your dog looks here. Pure joy",
        "This is everything. Dogs really do make every outing better",
        "What a gem of a {place_type}! Your pup looks right at home",
    ],
    "question": [
        "Love this! Do they provide water bowls for dogs too?",
        "This looks incredible! Is this spot usually busy with dogs or more of a hidden gem?",
        "Amazing shot! How did your pup handle the {context}? Ours would go crazy",
        "Such a great vibe! Do you visit here often with your dog?",
        "Beautiful! Is this place easy to get to with a bigger dog?",
        "Love the energy here! Any tips for first-time visitors with dogs?",
        "How does your pup do in new places? Mine takes a while to warm up",
        "This looks so relaxed! Is it usually this chill with dogs around?",
        "Love the setup! Do they have outdoor seating that works for dogs?",
        "How long have you been going here? Looks like a regular spot for you two",
        "Such a cute pup! How old are they?",
        "This place looks perfect. Did you stumble on it or was it recommended?",
    ],
    "empathy": [
        "We know that look — pure happiness! Dogs just make everything better",
        "That face says it all! Nothing beats a good adventure with your best friend",
        "This is what it's all about — making memories with our four-legged family",
        "Your dog is living their best life and honestly, we're here for it",
        "The bond between you two really shows in this photo. So sweet",
        "There's nothing like seeing a happy dog in their element. Warms the heart",
        "Dogs have this amazing way of making every ordinary moment feel special",
        "You can tell your pup feels so safe and loved. Beautiful to see",
        "This is the content we live for. Happy dogs, happy humans",
        "The tail wag energy is coming right through the screen",
    ],
    "local_knowledge": [
        "Such a great spot in {city_name}! Have you explored the {area} area too?",
        "{city_name} is so underrated for dog-friendly adventures — love seeing this!",
        "One of the best things about {city_name} is how dog-friendly it is. Great find!",
        "{city_name} keeps getting more dog-friendly every year. Love to see it!",
        "There are so many hidden gems for dogs in {city_name}. This is a great one",
        "The dog scene in {city_name} is really growing. Such a good find",
    ],
    # Non-English templates
    "french": [
        "Magnifique ! Votre chien a l'air tellement heureux",
        "On adore ! {city_name} est vraiment top pour les chiens",
        "Trop mignon ! Merci de partager ces endroits dog-friendly",
        "Super trouvaille ! Les toutous méritent les meilleurs endroits",
        "Quelle belle balade ! Votre chien a l'air ravi",
        "C'est tellement chouette de voir des endroits aussi accueillants pour les chiens",
        "Votre toutou a vraiment trouvé son coin préféré on dirait",
        "Ça fait plaisir de voir ça ! Les chiens sont les bienvenus partout",
    ],
    "spanish": [
        "¡Qué bonito! Tu perro se ve muy feliz aquí",
        "¡Increíble lugar! {city_name} tiene sitios geniales para perros",
        "Nos encanta ver lugares así de dog-friendly",
        "¡Qué descubrimiento! Los perritos merecen los mejores paseos",
        "Se nota que tu perro la está pasando genial. ¡Qué lindo!",
        "Me encanta este sitio. Los perros se lo merecen todo",
        "¡Qué alegría ver lugares donde los perros son bienvenidos!",
        "Tu perro tiene cara de felicidad total. ¡Precioso!",
    ],
    "japanese": [
        "最高ですね！ワンちゃんもとっても楽しそう",
        "素敵な場所！{city_name}はワンコに優しい街ですね",
        "めちゃくちゃかわいい！犬と一緒にお出かけ最高ですね",
        "こういうドッグフレンドリーな場所、もっと知りたいです",
        "ワンちゃんの表情が最高です！楽しんでますね",
        "こんな素敵な場所があるんですね。愛犬と行ってみたい",
        "犬と一緒に楽しめる場所、本当にありがたいですよね",
        "幸せそうなワンちゃんの写真、癒されます",
    ],
    "german": [
        "Wunderschön! Euer Hund sieht so glücklich aus",
        "Toll! {city_name} ist wirklich hundefreundlich",
        "So schön! Hunde verdienen die besten Abenteuer",
        "Was für ein toller Ort! Euer Hund fühlt sich sichtlich wohl",
        "Das sieht nach einem perfekten Tag mit Hund aus",
        "Hundefreundliche Orte wie dieser verdienen mehr Aufmerksamkeit",
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
    # Japanese — require SEVERAL CJK/kana chars. A lone character (e.g. the
    # katakana in the meme hashtag "fypシ", or a decorative symbol) must not
    # flip an otherwise-English post to Japanese and trigger a Japanese comment.
    cjk = sum(1 for c in caption if '぀' <= c <= 'ヿ' or '一' <= c <= '鿿')
    if cjk >= 4:
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


CITY_SIGNALS = {
    "los-angeles": ["los angeles", "losangeles", "socal", "hollywood",
                    "santa monica", "venice beach", "dtla", "silver lake",
                    "echo park", "#la ", "#ladogs", "dogsofla",
                    "orange county", "newport beach", "long beach", "pasadena"],
    "new-york-city": ["new york", "newyork", "nyc", "brooklyn", "manhattan",
                      "queens", "the bronx"],
    "london": ["london", "brixton", "shoreditch", "camden",
               "hampstead", "marylebone", "notting hill", "twickenham",
               "richmond upon thames"],
    "barcelona": ["barcelona", "bcn", "cataluña", "catalunya", "catalonia"],
    "paris": ["paris", "parisien", "parisienne", "montmartre", "marais",
              "île saint-louis", "ile saint-louis"],
    "tokyo": ["tokyo", "東京", "渋谷", "新宿", "代々木", "お台場", "東京犬"],
    # 2026-07-23: tightened — "swiss"/"switzerland"/"zurich" pulled in
    # German-speaking accounts with no Geneva tie (bumer.shop7 etc.)
    "geneva": ["geneva", "genève", "geneve", "genf", "lac léman", "lake geneva",
               "carouge", "eaux-vives"],
    "sydney": ["sydney", "bondi", "manly", "pyrmont", "surry hills",
               "#dogfriendlysydney"],
    "atlanta": ["atlanta", "beltline", "buckhead", "midtown atl", "#atl ",
                "atldogs", "piedmont park", "fetch park", "old fourth ward"],
}

# Compact per-city tokens that count as evidence when found in the ACCOUNT
# HANDLE itself (e.g. benjisguideto*nyc*, citydog*atlanta*, woolstore1888*sydney*)
CITY_HANDLE_TOKENS = {
    "los-angeles": ["losangeles", "ladog", "dogsofla", "socal", "hollywood",
                    "weho", "dtla"],
    "new-york-city": ["nyc", "newyork", "brooklyn", "manhattan"],
    "london": ["london"],
    "barcelona": ["barcelona", "bcn"],
    "paris": ["paris"],
    "tokyo": ["tokyo"],
    "geneva": ["geneva", "geneve", "genf"],
    "sydney": ["sydney", "bondi", "aussie", "aus"],
    "atlanta": ["atlanta", "atldog", "atlpup"],
}

_NORMALIZED_CITY = {"los_angeles": "los-angeles", "new_york": "new-york-city"}


def load_curated_city_map():
    """handle(lower) -> city-slug (or "*" when list membership is city-agnostic).
    Sources: influencer-targets.json, target-handles.json,
    instagram-following.json (city_breakdown + full accounts list)."""
    curated = {}
    try:
        for handle, meta in json.load(open(DATA_DIR / "influencer-targets.json")).items():
            city = (meta or {}).get("city") if isinstance(meta, dict) else None
            curated[handle.lower().lstrip("@")] = city or "*"
    except Exception:
        pass
    try:
        for handle, tag in json.load(open(DATA_DIR / "target-handles.json")).items():
            city = str(tag).split(":")[-1] if ":" in str(tag) else "*"
            curated[handle.lower().lstrip("@")] = _NORMALIZED_CITY.get(city, city)
    except Exception:
        pass
    try:
        following = json.load(open(DATA_DIR / "instagram-following.json"))
        for city, users in (following.get("city_breakdown") or {}).items():
            slug = _NORMALIZED_CITY.get(city, city.replace("_", "-"))
            for u in users:
                curated[u.lower().lstrip("@")] = slug
        for acc in following.get("accounts") or []:
            curated.setdefault((acc.get("username") or "").lower(), "*")
    except Exception:
        pass
    curated.pop("", None)
    return curated


_CURATED_CITY_MAP = None


def city_evidence(post):
    """Hard evidence that a post is tied to its assigned city, or None.

    Counts as evidence (2026-07-23, per Eric: only verifiably city-tied targets):
      1. tagged location matching the city's signals
      2. a city signal appearing in the hashtags
      3. the account handle containing a city token
      4. the account being on a curated city list (influencers, venue targets,
         our vetted following list)
    Caption-only keyword matches do NOT count — that is how off-market posts
    (Croatia beach, Italian travel dogs) used to slip through.
    """
    global _CURATED_CITY_MAP
    city = post.get("city")
    if not city:
        return None
    signals = CITY_SIGNALS.get(city, [])

    loc = (post.get("locationName") or "").strip().lower()
    if loc and any(sig in loc for sig in signals):
        return f"location:{(post.get('locationName') or '').strip()}"

    tags = " ".join(post.get("hashtags") or []).lower()
    if tags:
        for sig in signals:
            compact = sig.replace(" ", "").replace("#", "").strip()
            if len(compact) >= 3 and compact in tags:
                return f"hashtag:{compact}"

    handle = (post.get("ownerUsername") or "").lower()
    for token in CITY_HANDLE_TOKENS.get(city, []):
        if token in handle:
            return f"handle:{token}"

    if _CURATED_CITY_MAP is None:
        _CURATED_CITY_MAP = load_curated_city_map()
    curated_city = _CURATED_CITY_MAP.get(handle)
    if curated_city in ("*", city):
        return f"curated:{curated_city}"

    return None


def detect_city(caption, hashtags, location):
    """Try to detect which city the post is about.

    Location-field-first (2026-07-21): the post's tagged location is the most
    reliable signal we have. If a location IS tagged and it matches one of our
    cities uniquely, use it. If a location is tagged and matches NONE of our
    cities (e.g. "Crikvenica, Croatia", "Holkham Beach, Norfolk"), return None
    — the post is off-market and caption keywords must not override that.
    Only when no location is tagged do we fall back to caption + hashtags."""
    city_signals = CITY_SIGNALS

    def unique_match(text):
        matched = [slug for slug, signals in city_signals.items()
                   if any(s in text for s in signals)]
        return matched[0] if len(matched) == 1 else None

    loc = (location or "").strip().lower()
    if loc:
        loc_match = unique_match(loc)
        # Tagged location wins — and a tagged location OUTSIDE our markets
        # disqualifies the post entirely (no caption-keyword override).
        return loc_match

    text = ((caption or "") + " " + " ".join(hashtags or [])).lower()
    return unique_match(text)


# ─── Content Safety Screening ────────────────────────────────────────────────
# Multi-layered system to prevent commenting on sensitive/inappropriate posts.
# Layer 1: Fast keyword blocklist (multi-language)
# Layer 2: AI screening via OpenAI for borderline cases
# Layer 3: Queue-level gating before comment generation

# Keywords that indicate a post is about death, grief, illness, abuse, or
# other sensitive topics where a cheerful brand comment would be inappropriate.
# Organized by language, lowercase. Each list is checked against the caption.
SENSITIVE_KEYWORDS = {
    "english": [
        # Death / loss / grief
        "passed away", "rest in peace", "r.i.p", "rainbow bridge",
        "crossed the bridge", "gone too soon", "lost my dog", "lost our dog",
        "lost my boy", "lost my girl", "lost my best friend",
        "we lost him", "we lost her", "i lost him", "i lost her",
        "in memory of", "in memoriam",
        "farewell", "goodbye forever", "final goodbye", "last day with",
        "last moments", "put to sleep", "put down", "euthan",
        "grief", "grieving", "mourning", "heartbroken", "devastated",
        "miss you", "miss him", "miss her", "miss them",
        "no longer with us", "left us", "taken from us",
        "fly high", "forever in my heart", "forever in our hearts",
        "until we meet again", "wait for me", "watching over",
        # Illness / medical
        "diagnosed with", "cancer", "tumor", "tumour", "terminal",
        "fighting for", "last fight", "emergency surgery", "critical condition",
        "didn't make it", "didn't survive",
        # Abuse / rescue from trauma
        "abused", "beaten", "starved", "neglected", "tortured",
        "found abandoned", "left to die", "dumped",
        # Missing / stolen
        "missing dog", "stolen dog", "dog stolen", "have you seen",
        "please help find", "lost dog", "dog is lost", "dog is missing",
        # Controversy / politics
        "protest", "boycott", "scandal",
    ],
    "spanish": [
        "descansa en paz", "dep ", "en paz descanse",
        "cruzó el puente", "puente del arcoíris", "se nos fue",
        "nos ha dejado", "nos dejó", "ya no está", "ya no estas",
        "falleció", "fallecido", "murió", "ha muerto",
        "último adiós", "despedida", "adiós para siempre",
        "te extraño", "te echamos de menos", "duele mucho",
        "en memoria", "homenaje", "luto",
        "cáncer", "tumor", "diagnóstico", "terminal",
        "maltratado", "abandonado", "rescatado de",
        "perro perdido", "perro robado",
        "ha dejado de ser", "dejado de ser",
        "ayudarle a descansar", "compañero de vida",
        "me vas a faltar", "sigo sin asimilar",
        "empezado a empeorar", "duele mucho mucho",
    ],
    "french": [
        "repose en paix", "paix à", "parti trop tôt",
        "nous a quittés", "nous a quitté", "n'est plus",
        "au revoir", "adieu", "dernier adieu", "derniers moments",
        "arc-en-ciel", "pont de l'arc-en-ciel",
        "parti au ciel", "rejoint les étoiles",
        "tu me manques", "il me manque", "elle me manque",
        "en mémoire", "hommage", "deuil",
        "cancer", "tumeur", "euthanasie",
        "maltraité", "abandonné", "sauvé de",
        "chien perdu", "chien volé",
    ],
    "german": [
        "ruhe in frieden", "rip ", "regenbogenbrücke",
        "über die brücke", "von uns gegangen",
        "hat uns verlassen", "ist gegangen", "letzter tag",
        "letzter abschied", "abschied nehmen",
        "vermisse dich", "fehlt mir", "fehlt uns",
        "im gedenken", "in erinnerung", "trauer",
        "krebs", "tumor", "eingeschläfert",
        "misshandelt", "ausgesetzt", "gerettet von",
        "hund vermisst", "hund gestohlen",
    ],
    "japanese": [
        "虹の橋", "天国へ", "亡くなり", "旅立ち", "お別れ",
        "安らかに", "最期の", "最後の日",
        "寂しくなる", "会いたい", "忘れない",
        "癌", "腫瘍", "安楽死",
        "虐待", "迷子犬", "行方不明",
    ],
    "portuguese": [
        "descanse em paz", "ponte do arco-íris",
        "nos deixou", "partiu", "foi embora",
        "saudade", "luto", "em memória",
        "último adeus", "despedida",
    ],
    "catalan": [
        "descansa en pau", "ens ha deixat",
        "pont de l'arc de sant martí",
    ],
}

# Flatten all keywords into a single set for fast lookup
ALL_SENSITIVE_KEYWORDS = set()
for lang_keywords in SENSITIVE_KEYWORDS.values():
    ALL_SENSITIVE_KEYWORDS.update(lang_keywords)


def screen_post_content(caption, post_id="", username=""):
    """
    Screen a post's caption for sensitive content.
    Returns (is_safe, reason) tuple.

    Layer 1: Keyword blocklist — fast, catches obvious cases.
    Layer 2: AI screening — catches subtle/contextual cases.
    """
    if not caption or len(caption.strip()) < 10:
        # Very short or empty captions — skip AI screening, allow with caution
        return True, "no_caption"

    lower = caption.lower()

    # ── Layer 1: Keyword blocklist ──
    for keyword in ALL_SENSITIVE_KEYWORDS:
        if keyword in lower:
            return False, f"keyword_blocked: '{keyword}'"

    # ── Layer 2: AI content screening ──
    # Only for posts with substantial captions (where context matters)
    if len(caption) > 50:
        ai_result = ai_screen_caption(caption, username)
        if ai_result is not None:
            return ai_result

    return True, "passed_all_screens"


def ai_screen_caption(caption, username=""):
    """
    Use OpenAI to assess whether a post is appropriate for brand engagement.
    Returns (is_safe, reason) or None if AI screening is unavailable.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        # If no API key, rely on keyword screening only
        return None

    prompt = f"""You are a content safety screener for a dog-friendly brand (@thepawcities).
Your job is to decide if it's appropriate for our brand to leave a friendly comment on this Instagram post.

REJECT posts about:
- Death, loss, grief, or memorial tributes for a pet or person
- Illness, injury, surgery, or medical emergencies
- Animal abuse, cruelty, neglect, or rescue trauma stories
- Missing or stolen pets
- Controversial topics, politics, protests
- Fundraising/GoFundMe requests for sick or dying animals
- Any emotional or sad content where a cheerful brand comment would be tone-deaf
- Posts that are clearly personal/emotional moments not meant for brand engagement

APPROVE posts about:
- Dog-friendly places, cafes, restaurants, parks, beaches, hotels
- Happy dogs exploring cities
- Dog travel, adventures, outings
- Dog products, gear, toys
- Cute/funny dog moments
- Dog training or socialization
- Dog events or meetups

POST by @{username}:
"{caption[:600]}"

Reply with EXACTLY one word: SAFE or UNSAFE
Then on a new line, a brief reason (max 10 words)."""

    try:
        req_body = json.dumps({
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 30,
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=req_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_key}",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            reply = data["choices"][0]["message"]["content"].strip()

            lines = reply.split("\n", 1)
            verdict = lines[0].strip().upper()
            reason = lines[1].strip() if len(lines) > 1 else ""

            if verdict == "UNSAFE":
                return False, f"ai_blocked: {reason}"
            elif verdict == "SAFE":
                return True, f"ai_approved: {reason}"
            else:
                # Ambiguous response — err on the side of caution
                print(f"    ⚠️ AI screening ambiguous for @{username}: {reply}")
                return False, f"ai_ambiguous: {reply[:50]}"

    except Exception as e:
        # AI screening failed — fall through to keyword-only
        print(f"    ⚠️ AI screening failed: {e}")
        return None


def ai_generate_comment(post, ctx):
    """
    Write a GENUINE, per-post comment tailored to the actual photo AND caption,
    using OpenAI's vision-capable models.

    When a displayUrl (image) is available, uses gpt-4o with vision so the AI
    actually SEES the dog, the venue, the setting — producing comments that
    reference visual details a real person would notice ("love those floppy ears",
    "that patio looks amazing"). Falls back to text-only gpt-4o-mini when no
    image is available.

    Returns the comment text (str) on success, or None when AI is unavailable,
    the caption is too thin to tailor to, or generation fails — in which case
    generate_comment() falls back to the template bank below.

    Guardrails preserved from the template path:
      - Only names a city when our content-corroborated detection confirmed one.
      - Matches the post's language.
      - No hashtags / links / @mentions / follow-or-visit pitches.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        return None

    caption = (post.get("caption") or "").strip()
    image_url = (post.get("displayUrl") or "").strip()

    # With no caption AND no image, nothing to react to.
    if len(caption) < 15 and not image_url:
        return None

    username = post.get("ownerUsername", "")
    location = (post.get("locationName") or "").strip()
    language = ctx.get("language", "english")
    place_type = ctx.get("place_type", "spot")
    city_name = ctx.get("city_name") or ""
    is_place_post = ctx.get("is_place_post", False)

    lang_label = {
        "english": "English", "french": "French", "spanish": "Spanish",
        "japanese": "Japanese", "german": "German",
    }.get(language, "the same language the post is written in")

    if city_name:
        city_rule = f'- You MAY refer to the city as "{city_name}" if it fits naturally, but never force it.'
    else:
        city_rule = "- Do NOT name any city, neighborhood, or country — the location is not confirmed."

    if is_place_post and place_type != "spot":
        place_line = f"- This post is about a visitable {place_type}; you can react to the place itself."
    else:
        place_line = "- This may be a dog portrait or a moment rather than a specific venue — react to the dog/mood, don't assume a place to visit."

    # Build image-aware instructions when we have a photo
    if image_url:
        image_instruction = """- You can SEE the photo. Reference something VISUAL you notice — the dog's expression, breed features, the setting, colors, food, scenery, or the vibe. A comment that reacts to what's IN the image feels genuinely human.
- Combine visual details with caption context for the most authentic comment."""
    else:
        image_instruction = "- Reference something SPECIFIC from the caption (the place, the business, the activity, the dog, the experience)."

    prompt_text = f"""You write Instagram comments for @thepawcities, a brand that helps people discover dog-friendly places — cafes, restaurants, parks, beaches and hotels — across major cities.

Write ONE genuine comment reacting to the specific post below. It must read like a real person on the Paw Cities team who actually looked at THIS exact post — not a reused template.

RULES:
- Respond in {lang_label}.
{image_instruction}
- Be concrete, never generic filler. Avoid vague praise like "so cute!" or "love this!" — say WHAT specifically you love.
- Warm, natural, conversational. One sentence, ideally under 18 words.
- No hashtags, no links, no @mentions, no asking them to follow or visit our page, no sales pitch.
- At most one emoji, only if it truly fits. Usually none.
{city_rule}
{place_line}
- Never invent facts not shown in the post or photo.

POST by @{username}{f' (tagged location: {location})' if location else ''}:
\"{caption[:700]}\""""

    try:
        # Build message content — multimodal when image is available
        if image_url:
            # Use vision-capable model for image + text
            model = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")
            content = [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": image_url, "detail": "low"}},
            ]
        else:
            # Text-only fallback
            model = os.environ.get("OPENAI_COMMENT_MODEL", "gpt-4o-mini")
            content = prompt_text

        req_body = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.9,
            "max_tokens": 80,
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=req_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_key}",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data["choices"][0]["message"]["content"].strip()

        # Strip accidental wrapping quotes / whitespace.
        text = text.strip().strip('"').strip("'").strip()

        # Reject empties, over-long output, or model refusals.
        if not text or len(text) > 280:
            return None
        low = text.lower()
        if low.startswith(("i cannot", "i can't", "i'm sorry", "sorry,", "as an ai")):
            return None
        return text

    except Exception as e:
        print(f"    ⚠️ AI comment generation failed: {e}")
        return None


def generate_comment(post, config):
    """Generate a contextual, non-spammy comment for a post."""
    caption = post.get("caption", "") or ""
    hashtags = post.get("hashtags", [])
    location = post.get("locationName", "")
    username = post.get("ownerUsername", "")

    language = detect_language(caption)
    place_type = detect_place_type(caption, hashtags)

    # Is this post actually about a VISITABLE PLACE (cafe/park/beach/hotel/...)?
    # Many posts are dog portraits, themed shots (e.g. World Cup jerseys) or
    # event/group photos — for those, "Is this spot easy to get to?" or "hidden
    # gems... this is a great one" read as nonsense. We only allow place/question
    # templates when there's real evidence of a venue: a detected place type, a
    # venue-type hashtag, or a specific (non-city) tagged location.
    _venue_tag_words = ("cafe", "café", "restaurant", "beach", "park", "hotel",
                        "bar", "pub", "brewery", "resort", "trail", "patio",
                        "garden", "museum", "gallery", "market", "winery",
                        "vineyard", "shop", "store", "farm")
    _tag_blob = " ".join(hashtags or []).lower()
    _loc = (location or "").strip()
    is_place_post = (
        place_type != "spot"
        or any(w in _tag_blob for w in _venue_tag_words)
        or (bool(_loc) and "," in _loc)  # "Venue Name, City" style tag
    )

    # City must be CORROBORATED by the post's own content (caption / hashtags /
    # location) before we ever put a city name in a comment. The scrape-batch
    # stamp (post["city"]) only records which hashtag bucket surfaced the post —
    # and because every city bucket also scrapes GLOBAL tags (#dogcafe,
    # #travelwithdog, ...), a post from anywhere in the world can land in the
    # "london" or "nyc" bucket. That stamp is therefore NOT evidence of location
    # and must never drive comment wording. Content wins; unverified stamp is
    # ignored for wording (it can still be used for routing/analytics elsewhere).
    detected_city = detect_city(caption, hashtags, location)
    city_slug = detected_city
    city_confirmed = city_slug is not None
    city_name = config["cities"].get(city_slug, {}).get("name", "") if city_slug else ""

    # ── Genuine per-post generation (preferred) ─────────────────────────────
    # Rather than slot-filling one of a few dozen recycled lines, ask the model
    # to write a comment that reacts to THIS specific post — reusing the context
    # we just detected (language, place type, confirmed city) as guardrails.
    # Falls through to the template bank below whenever AI is unavailable, the
    # caption is too thin, or generation fails.
    ai_text = ai_generate_comment(post, {
        "language": language,
        "place_type": place_type,
        "city_name": city_name if city_confirmed else "",
        "is_place_post": is_place_post,
    })
    if ai_text:
        comment_hash = hashlib.md5(f"{username}:{ai_text[:30]}".encode()).hexdigest()[:8]
        return {
            "text": ai_text,
            "category": "ai_generated",
            "language": language,
            "hash": comment_hash,
            "place_type": place_type,
            "detected_city": city_slug,
        }

    # Pick template category with weighted randomness
    # Mostly appreciation/empathy (brand-safe), occasionally questions or local knowledge
    category_weights = {
        "appreciation": 40,
        "empathy": 30,
        "question": 20,
        "local_knowledge": 10,
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

    # local_knowledge leans entirely on a city name / area — only offer it when
    # the city is actually confirmed from the post's own content.
    if not city_confirmed:
        category_weights.pop("local_knowledge", None)

    # question / local_knowledge both assume the post is about a visitable place.
    # On portraits, themed shots and event photos, drop them and lean on
    # appreciation/empathy (which are about the dog/moment, not a venue).
    if not is_place_post:
        category_weights.pop("question", None)
        category_weights.pop("local_knowledge", None)

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

    # Work out `area` (a distinct sub-neighborhood) up front, because template
    # eligibility depends on it. area is only trustworthy when we have a
    # confirmed city AND a real location string that (a) doesn't resolve to a
    # DIFFERENT city, and (b) isn't just the city name repeated — otherwise the
    # {area} template reads redundantly: "great spot in Los Angeles! ... the Los
    # Angeles area too?".
    city_ref = f"{city_name} " if city_name else ""
    area = ""
    if city_confirmed and location:
        candidate = location.split(",")[0].strip()
        same_as_city = candidate.lower() == (city_name or "").lower()
        if candidate and not same_as_city and detect_city(candidate, [], candidate) in (None, city_slug):
            area = candidate

    # Filter templates by what we can actually fill:
    #  - no confirmed city  -> drop anything naming a city or area (would read
    #    ungrammatically or name the wrong place).
    #  - confirmed city but no distinct area -> drop only {area} templates.
    def _needs_city(t):
        return "{city_ref}" in t or "{city_name}" in t
    def _needs_area(t):
        return "{area}" in t
    if not city_confirmed:
        templates = [t for t in templates if not _needs_city(t) and not _needs_area(t)] or [
            t for t in COMMENT_TEMPLATES["appreciation"] if not _needs_city(t) and not _needs_area(t)
        ]
    elif not area:
        filtered = [t for t in templates if not _needs_area(t)]
        if filtered:
            templates = filtered

    # On non-place posts, also drop any remaining template that assumes a
    # visitable venue ("spot", "place", "get to here", "hidden gem", ...) and
    # fall back to dog/moment-focused empathy lines that fit any post.
    if not is_place_post:
        _place_words = ("spot", "place", "gem", " here", "find", "discover",
                        "recognition", "visit", "get to", "outdoor seat",
                        "busy with dogs", "chill with dogs", "warm up",
                        "tips for", "going here", "stumble", "at home")
        def _assumes_place(t):
            tl = t.lower()
            return any(w in tl for w in _place_words)
        non_place = [t for t in templates if not _assumes_place(t)]
        if not non_place:
            non_place = [t for t in COMMENT_TEMPLATES["empathy"] if not _assumes_place(t)]
        templates = non_place or templates
    template = random.choice(templates)

    if not area:
        area = city_name or "the neighborhood"

    comment = template.format(
        city_ref=city_ref,
        city_name=city_name or "this city",
        place_type=place_type,
        context=place_type,
        area=area,
    )

    # Add slight variation: occasionally add emoji, vary punctuation
    # Only ~20% of comments get an emoji to look more natural
    if random.random() < 0.2:
        extra_emojis = ["🐶", "❤️", "✨", "🙌", "😊", "🌟", "💕", "🎉", "🐾", "💛", "🧡", "😍", "🐕"]
        comment += " " + random.choice(extra_emojis)

    # Vary ending punctuation for naturalness
    if random.random() < 0.15 and comment.endswith("."):
        comment = comment[:-1] + "!"
    elif random.random() < 0.1 and not comment[-1] in ".!?":
        comment += random.choice([".", "!", ""])

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
    safety_blocked = 0

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

        # Skip blocklisted accounts (confirmed off-market targets)
        if (post.get("ownerUsername") or "").lower() in ACCOUNT_BLOCKLIST:
            print(f"    🚫 SKIPPED @{post.get('ownerUsername')}: on engagement blocklist")
            continue

        # ── Content safety screening ──
        caption_text = (post.get("caption") or "")[:500]
        owner = post.get("ownerUsername", "")
        is_safe, reason = screen_post_content(caption_text, post_id, owner)
        if not is_safe:
            print(f"    🛡️ BLOCKED @{owner}: {reason}")
            safety_blocked += 1
            continue

        filtered.append({
            "id": post_id,
            "shortcode": post.get("shortCode", ""),
            "ownerUsername": owner,
            "ownerId": post.get("ownerId", ""),
            "caption": caption_text,
            "hashtags": post.get("hashtags", []),
            "mentions": post.get("mentions", []),
            "locationName": post.get("locationName"),
            "likesCount": post.get("likesCount", 0),
            "commentsCount": post.get("commentsCount", 0),
            "timestamp": post.get("timestamp"),
            "url": post.get("url", ""),
            "displayUrl": post.get("displayUrl", ""),
            # `city` is the scrape BUCKET (which hashtag set surfaced this post),
            # NOT proof of location — it also includes global tags. `detectedCity`
            # is the city actually corroborated by the post's own content and is
            # what comment wording should rely on (see generate_comment).
            "city": post.get("_city"),
            "detectedCity": detect_city(
                caption_text, post.get("hashtags", []), post.get("locationName")
            ),
            "discoveredAt": post.get("_discovered_at"),
            "safetyCheck": reason,
        })

    # Sort by engagement
    filtered.sort(key=lambda p: p.get("likesCount", 0), reverse=True)

    # Save
    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "total_raw": len(all_posts),
        "total_filtered": len(filtered),
        "safety_blocked": safety_blocked,
        "posts": filtered,
    }
    with open(POSTS_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n  📊 Discovery complete: {len(all_posts)} raw → {len(filtered)} eligible posts")
    if safety_blocked > 0:
        print(f"  🛡️ Safety blocked: {safety_blocked} sensitive posts")
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
    all_usernames = [u for u in all_usernames if u.lower() not in ACCOUNT_BLOCKLIST]
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
        owner = post.get("ownerUsername", "")

        # ── Content safety screening ──
        is_safe, reason = screen_post_content(caption[:500], post_id, owner)
        if not is_safe:
            print(f"    🛡️ BLOCKED @{owner}: {reason}")
            continue

        filtered.append({
            "id": post_id,
            "shortcode": post.get("shortCode", ""),
            "ownerUsername": owner,
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
            "safetyCheck": reason,
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


# ─── Supabase Cloud Queue Sink ───────────────────────────────────────────────
# When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (e.g. in GitHub Actions),
# generated comments are ALSO upserted into the engagement_queue table so
# posting sessions can pull them from the cloud without this machine.

def _supabase_env():
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return (url, key) if url and key else (None, None)


def _supabase_call(method, path, payload=None, prefer=None):
    url, key = _supabase_env()
    if not url:
        return None
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
        print(f"  ⚠️ Supabase {method} {path} failed: {e.code} {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"  ⚠️ Supabase {method} {path} failed: {e}")
        return None


def fetch_supabase_post_ids():
    """All post_ids ever queued in the cloud — used for dedupe on ephemeral runners."""
    url, _ = _supabase_env()
    if not url:
        return set()
    ids, offset = set(), 0
    while True:
        rows = _supabase_call("GET", f"/engagement_queue?select=post_id&limit=1000&offset={offset}")
        if not rows:
            break
        ids.update(r["post_id"] for r in rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return ids


def sync_queue_to_supabase(items):
    """Upsert queue items into engagement_queue; duplicates (same post_id) are ignored."""
    url, _ = _supabase_env()
    if not url or not items:
        return 0
    sent = 0
    for i in range(0, len(items), 200):
        chunk = [{
            "id": it["id"],
            "post_id": it["post_id"],
            "post_shortcode": it.get("post_shortcode", ""),
            "post_url": it.get("post_url", ""),
            "target_username": it.get("target_username", ""),
            "post_likes": it.get("post_likes", 0) or 0,
            "city": it.get("city"),
            "comment_text": it["comment_text"],
            "comment_category": it.get("comment_category"),
            "comment_language": it.get("comment_language"),
            "comment_hash": it.get("comment_hash"),
            "city_evidence": it.get("city_evidence"),
            "status": it.get("status", "pending"),
            "created_at": it.get("created_at"),
            "source": "cloud-discovery",
        } for it in items[i:i + 200]]
        result = _supabase_call(
            "POST", "/engagement_queue?on_conflict=post_id",
            payload=chunk, prefer="resolution=ignore-duplicates,return=minimal",
        )
        if result is not None:
            sent += len(chunk)
    return sent


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
    cloud_post_ids = fetch_supabase_post_ids()
    if cloud_post_ids:
        print(f"  ☁️ Cloud queue dedupe: {len(cloud_post_ids)} post_ids already queued")
        existing_post_ids |= cloud_post_ids
    commented_post_ids = {h["post_id"] for h in history}

    # Also track recent comment hashes to avoid repetitive phrasing
    recent_hashes = {item.get("comment_hash") for item in queue["items"][-100:]}

    new_count = 0
    blocked_count = 0
    evidence_skipped = 0
    for post in posts:
        post_id = post["id"]
        if post_id in existing_post_ids or post_id in commented_post_ids:
            continue

        # ── Evidence gate: only verifiably city-tied targets get comments ──
        evidence = city_evidence(post)
        if not evidence:
            print(f"  🎯 SKIPPED @{post.get('ownerUsername')}: no hard {post.get('city')} evidence")
            evidence_skipped += 1
            continue

        # ── Final safety gate: re-screen before generating comment ──
        # This catches posts that may have been added to discovered-posts.json
        # before the safety screening was deployed, or edited since discovery.
        if not post.get("safetyCheck"):
            caption = post.get("caption", "")
            owner = post.get("ownerUsername", "")
            is_safe, reason = screen_post_content(caption, post_id, owner)
            if not is_safe:
                print(f"  🛡️ Queue blocked @{owner}: {reason}")
                blocked_count += 1
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
            "city_evidence": evidence,
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

    # Mirror pending items to the cloud queue (no-op unless Supabase env is set)
    pending_items_for_sync = [i for i in queue["items"] if i["status"] == "pending"]
    synced = sync_queue_to_supabase(pending_items_for_sync)
    if synced:
        print(f"  ☁️ Synced {synced} pending comments to Supabase engagement_queue")

    pending = sum(1 for item in queue["items"] if item["status"] == "pending")
    print(f"\n🐕 Generated {new_count} new comments")
    if blocked_count > 0:
        print(f"   🛡️ Safety blocked: {blocked_count} posts (grief/sensitive content)")
    if evidence_skipped > 0:
        print(f"   🎯 Evidence gate skipped: {evidence_skipped} posts with no verifiable city tie")
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


# ─── Human-Like Timing ──────────────────────────────────────────────────────

import math

def human_delay(min_s, max_s):
    """Generate a human-like delay using log-normal distribution.

    Real humans browse in bursts: sometimes they engage quickly on 2-3 posts
    in a row, then disappear for 10-20 minutes. A uniform random distribution
    looks robotic. Log-normal gives frequent short gaps with occasional long
    pauses, which mimics real scrolling behavior.
    """
    # Log-normal: most delays cluster near min_s, with a long tail toward max_s
    mu = math.log(min_s + (max_s - min_s) * 0.3)  # median closer to the low end
    sigma = 0.6  # spread — higher = more variance
    delay = random.lognormvariate(mu, sigma)
    # Clamp to our bounds
    return max(min_s, min(max_s, delay))


def like_nearby_posts(cl, media_pk, config):
    """Like 1-3 posts near the target to simulate organic browsing.

    Instagram's ML models look for accounts that ONLY comment without any
    other interactions. Mixing in likes makes the activity pattern look
    like a real person scrolling their feed.
    """
    timing = config.get("timing", {})
    like_min = timing.get("likes_per_comment_min", 1)
    like_max = timing.get("likes_per_comment_max", 3)
    num_likes = random.randint(like_min, like_max)

    liked = 0
    try:
        # Like the post we're about to comment on (natural behavior)
        cl.media_like(media_pk)
        liked += 1
        time.sleep(random.uniform(1.5, 4.0))

        # Optionally like a few more from the same user or related posts
        if num_likes > 1:
            try:
                user_pk = cl.media_info(media_pk).user.pk
                user_medias = cl.user_medias(user_pk, amount=5)
                # Like 1-2 other recent posts from the same user
                for media in random.sample(user_medias[:5], min(num_likes - 1, len(user_medias[:5]))):
                    if str(media.pk) != str(media_pk):
                        cl.media_like(media.pk)
                        liked += 1
                        time.sleep(random.uniform(2.0, 6.0))
            except Exception:
                pass  # Non-critical — continue even if extra likes fail
    except Exception:
        pass  # Non-critical — continue to commenting even if likes fail

    return liked


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
    total_likes = 0
    session_start = time.time()
    session_max_s = timing.get("session_max_minutes", 90) * 60

    for item in pending[:batch_count]:
        # Session time limit — stop if we've been running too long
        elapsed = time.time() - session_start
        if elapsed > session_max_s and not dry_run:
            print(f"\n  ⏰ Session time limit ({timing.get('session_max_minutes', 90)}m) reached — stopping for today.")
            break

        # Batch break
        if posted_in_batch >= timing["batch_size"]:
            break_time = random.randint(timing["batch_break_min_seconds"], timing["batch_break_max_seconds"])
            print(f"\n  ☕ Batch break: {int(break_time/60)}m{break_time%60}s ({posted_in_batch} comments sent)...\n")
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

                # Like the post and a few others first (organic browsing behavior)
                likes = like_nearby_posts(cl, media_pk, config)
                total_likes += likes
                if likes:
                    print(f"     ❤️ Liked {likes} post{'s' if likes > 1 else ''}")

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

        # Human-like delay between comments (log-normal distribution)
        if not dry_run and total_posted < batch_count:
            delay = human_delay(timing["min_delay_seconds"], timing["max_delay_seconds"])
            delay_int = int(delay)
            if delay_int >= 60:
                print(f"     ⏳ Waiting {delay_int//60}m{delay_int%60}s...")
            else:
                print(f"     ⏳ Waiting {delay_int}s...")
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

    elapsed_min = int((time.time() - session_start) / 60)
    print(f"\n  📊 Batch complete: {total_posted} {'previewed' if dry_run else 'posted'}, {total_likes} likes")
    print(f"     Today total: {today_posted + (total_posted if not dry_run else 0)}/{daily_cap}")
    print(f"     Session duration: {elapsed_min}m\n")


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
        "Thank you so much! We're always on the lookout for great dog-friendly spots",
        "Thanks! We love connecting with fellow dog lovers",
        "Appreciate it! Your pup is adorable by the way",
        "That means a lot! Love this community of dog owners",
    ],
    "answer_question": [
        "Great question! We've heard really good things about that spot",
        "We've been there a few times — always a great experience with dogs!",
        "Totally! It's one of the best spots we've found. Dog owners love it",
        "From what we've seen, it's really accommodating for dogs of all sizes",
    ],
    "enthusiastic": [
        "Right?! So many amazing dog-friendly places out there",
        "We're so glad you agree! Always great to meet fellow dog explorers",
        "YES! That's exactly what we think too. Dogs deserve the best",
    ],
    "local_tip": [
        "If you love this spot, {city_ref}has so many more gems like it!",
        "Great taste! {city_ref}is really becoming a top dog-friendly destination",
    ],
    "follow_invite": [
        "So glad you liked it! We're always sharing dog-friendly discoveries",
        "Thanks for the love! Always great connecting with dog owners like you",
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

            # Delay between re-engagements (warm leads, but still be careful)
            if posted < len(batch):
                delay = human_delay(60, 180)
                delay_int = int(delay)
                print(f"     ⏳ Waiting {delay_int}s...")
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

            # Delay between follows (conservative — follows are high-risk actions)
            if followed_count < len(batch):
                delay = human_delay(60, 180)
                delay_int = int(delay)
                print(f"     ⏳ Waiting {delay_int}s...")
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


# ─── FOLLOW ALL NEW FOLLOWERS ────────────────────────────────────────────────

FOLLOWERS_TRACKER_FILE = ENGAGEMENT_DIR / "followers-tracker.json"


def load_followers_tracker():
    """Load the set of accounts we've already followed back."""
    if FOLLOWERS_TRACKER_FILE.exists():
        try:
            return json.loads(FOLLOWERS_TRACKER_FILE.read_text())
        except Exception:
            pass
    return {"already_followed_back": [], "last_check": None, "total_followed": 0}


def save_followers_tracker(data):
    FOLLOWERS_TRACKER_FILE.write_text(json.dumps(data, indent=2, default=str))


def follow_all_new_followers(limit=50, dry_run=False):
    """Follow back ALL accounts that follow us.

    Unlike follow_engaged_accounts() which only follows people who replied
    to our comments, this follows every new follower — maximizing early-stage
    reciprocity and community building.

    Uses instagrapi's user_followers() to get our current follower list,
    then follows anyone we haven't followed back yet.
    """
    print(f"\n🤝 PawCities Follow-Back All Followers")
    print(f"   {'(DRY RUN)' if dry_run else ''}\n")

    tracker = load_followers_tracker()
    already_set = set(tracker["already_followed_back"])
    our_username = os.environ.get("IG_USERNAME", "thepawcities").lower()

    cl = get_ig_client()

    # Get our user ID
    try:
        our_info = cl.user_info_by_username(our_username)
        our_pk = our_info.pk
        follower_count = getattr(our_info, 'follower_count', None) or getattr(our_info, 'followers_count', 0)
        following_count = getattr(our_info, 'following_count', None) or getattr(our_info, 'media_count', 0)
        print(f"  📊 @{our_username}: {follower_count} followers, {following_count} following")
    except Exception as e:
        print(f"  ❌ Could not get our account info: {e}")
        return

    # Get our followers (returns dict of {user_pk: UserShort})
    print(f"  📥 Fetching follower list...")
    try:
        # instagrapi returns a list of UserShort objects
        followers = cl.user_followers(our_pk, amount=0)  # 0 = all
        # followers is a dict {pk: UserShort} in newer instagrapi versions
        if isinstance(followers, dict):
            follower_list = list(followers.values())
        else:
            follower_list = list(followers)
        print(f"  ✅ Found {len(follower_list)} followers")
    except Exception as e:
        print(f"  ❌ Could not fetch followers: {e}")
        return

    # Get who we already follow (to skip them)
    print(f"  📥 Fetching who we follow...")
    try:
        following = cl.user_following(our_pk, amount=0)
        if isinstance(following, dict):
            following_pks = set(following.keys())
        else:
            following_pks = {u.pk for u in following}
        print(f"  ✅ Currently following {len(following_pks)} accounts")
    except Exception as e:
        print(f"  ⚠️ Could not fetch following list, will try to follow all: {e}")
        following_pks = set()

    # Find followers we haven't followed back
    new_to_follow = []
    for user in follower_list:
        username = getattr(user, 'username', str(user))
        pk = getattr(user, 'pk', None)
        if username.lower() == our_username:
            continue
        if username in already_set:
            continue
        if pk and pk in following_pks:
            # We already follow them — just record it
            already_set.add(username)
            continue
        new_to_follow.append({"username": username, "pk": pk})

    if not new_to_follow:
        print(f"\n  🎉 All followers already followed back!\n")
        tracker["last_check"] = datetime.now(timezone.utc).isoformat()
        save_followers_tracker(tracker)
        return

    batch = new_to_follow[:limit]
    print(f"\n  🆕 {len(new_to_follow)} new followers to follow back | Processing top {len(batch)}\n")

    followed_count = 0
    for i, account in enumerate(batch):
        username = account["username"]
        pk = account["pk"]

        if dry_run:
            print(f"  [DRY] Would follow @{username}")
            followed_count += 1
            continue

        try:
            if not pk:
                user_info = cl.user_info_by_username(username)
                pk = user_info.pk

            cl.user_follow(pk)
            already_set.add(username)
            followed_count += 1
            print(f"  ✅ Followed @{username}")

            # Conservative delay between follows
            if i < len(batch) - 1:
                delay = human_delay(45, 120)
                delay_int = int(delay)
                print(f"     ⏳ Waiting {delay_int}s...")
                time.sleep(delay)

        except Exception as e:
            error_str = str(e)
            if "action_block" in error_str.lower() or "challenge" in error_str.lower():
                print(f"  ⚠️ @{username}: {error_str[:80]}")
                print(f"\n  🚨 ACTION BLOCK — stopping. Followed {followed_count} this run.\n")
                break

            if is_login_error(error_str):
                print(f"  ⚠️ Session expired: {error_str[:80]}")
                cl = reauth_ig_client()
                if cl is None:
                    print(f"\n  🚨 Cannot re-authenticate — stopping.\n")
                    break
                continue

            print(f"  ⚠️ @{username}: {error_str[:80]}")

    # Save state
    tracker["already_followed_back"] = list(already_set)
    tracker["last_check"] = datetime.now(timezone.utc).isoformat()
    tracker["total_followed"] = tracker.get("total_followed", 0) + followed_count
    save_followers_tracker(tracker)

    print(f"\n  📊 Done: {followed_count} new follows this run | {len(already_set)} total tracked\n")


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

    # follow-all-followers
    faf_p = subparsers.add_parser("follow-all-followers", help="Follow back ALL new followers")
    faf_p.add_argument("--limit", type=int, default=50, help="Max accounts to follow (default 50)")
    faf_p.add_argument("--dry-run", action="store_true", help="Preview without following")

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
    elif args.command == "follow-all-followers":
        follow_all_new_followers(limit=args.limit, dry_run=args.dry_run)
    elif args.command == "reset-failures":
        reset_session_failures()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

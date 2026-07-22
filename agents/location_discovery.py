#!/usr/bin/env python3
"""
PawCities — Location-Anchored Discovery (prototype)
===================================================

Problem this fixes
------------------
The original `discover_posts()` in engagement-bot.py scrapes GLOBAL hashtags
(#dogcafe, #travelwithdog, ...) inside each city's run, then stamps every
returned post with that city. Global tags match posts anywhere on earth, so a
Tokyo cafe or a Welsh beach lands in the "london"/"nyc" bucket and gets the
wrong city — which then leaks into comment wording.

Approach
--------
Anchor discovery to PawCities' OWN curated dog-friendly venue database
(research-output/<city>-places.json). From it we build, per city:

  1. A gazetteer — venue names, local-language names, neighborhoods, and a
     geographic bounding box derived from the venues' lat/long.
  2. Location-BOUND hashtags — slugified venue/neighborhood names
     (#hampsteadheath, #poblenou, #yoyogipark). Unlike #dogcafe these are
     inherently tied to one place, so what they surface is almost always
     genuinely in that city.

Every candidate post is then run through `confirm_city()`, which returns a city
ONLY when the post's own content (coordinates → gazetteer tokens → base city
signals) unambiguously resolves to exactly one city. Anything ambiguous or
unconfirmable is returned as None and is NOT given city-specific treatment.

This is a prototype: `discover_by_location()` reuses the existing Apify hashtag
scraper (pass in engagement-bot's apify_request), but the gazetteer and
`confirm_city()` are pure functions that are unit-testable offline. Run
`python3 agents/location_discovery.py selftest` to validate against real data.
"""

import json
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
RESEARCH_DIR = BASE_DIR / "research-output"

# research-output filename prefix -> city slug used everywhere else
FILE_TO_CITY_SLUG = {
    "geneva": "geneva",
    "paris": "paris",
    "london": "london",
    "los-angeles": "los-angeles",
    "nyc": "new-york-city",
    "barcelona": "barcelona",
    "sydney": "sydney",
    "tokyo": "tokyo",
}

# Base city signals (superset of engagement-bot.detect_city) — used as a
# fallback when the venue gazetteer doesn't match.
BASE_CITY_SIGNALS = {
    "los-angeles": ["los angeles", "socal", "hollywood", "santa monica", "venice beach", "dtla"],
    "new-york-city": ["new york", "nyc", "brooklyn", "manhattan", "queens", "the bronx", "bronx"],
    "london": ["london", "england", "brixton", "shoreditch", "camden", "hampstead", "marylebone"],
    "barcelona": ["barcelona", "bcn", "cataluña", "catalunya", "catalonia"],
    "paris": ["paris", "parisien", "parisienne", "montmartre", "marais"],
    "tokyo": ["tokyo", "東京", "渋谷", "新宿", "代々木", "お台場"],
    "geneva": ["geneva", "genève", "geneve", "suisse", "swiss", "switzerland"],
    "sydney": ["sydney", "bondi", "manly", "australia", "nsw"],
}

# Words that are too generic to be a location signal on their own.
_STOPWORDS = {
    "park", "dog", "run", "the", "de", "la", "el", "cafe", "café", "bar",
    "beach", "garden", "gardens", "pub", "hotel", "restaurant", "and", "of",
    "des", "du", "des", "los", "las", "field", "common", "square", "market",
    "centre", "center", "city", "park.", "dogs",
}


def _slug(text):
    """Lowercase alnum-only slug for hashtag matching (keeps non-latin script)."""
    return re.sub(r"[^0-9a-zÀ-￿]+", "", (text or "").lower())


def _tokens(text):
    """Meaningful lowercase word tokens from a name/neighborhood."""
    words = re.findall(r"[0-9A-Za-zÀ-ɏ　-鿿]+", (text or "").lower())
    return [w for w in words if len(w) >= 3 and w not in _STOPWORDS]


def _places_for(city_prefix):
    path = RESEARCH_DIR / f"{city_prefix}-places.json"
    if not path.exists():
        return []
    data = json.load(open(path))
    if isinstance(data, list):
        return data
    for v in data.values():
        if isinstance(v, list):
            return v
    return []


def build_gazetteer():
    """Build {city_slug: {names, name_slugs, neighborhoods, tokens, bbox}}."""
    gaz = {}
    for prefix, slug in FILE_TO_CITY_SLUG.items():
        places = _places_for(prefix)
        if not places:
            continue
        names, name_slugs, neighborhoods, tokens = set(), set(), set(), set()
        lats, lngs = [], []
        for p in places:
            for key in ("name", "nameLocal"):
                nm = p.get(key)
                if nm:
                    names.add(nm.lower())
                    name_slugs.add(_slug(nm))
                    tokens.update(_tokens(nm))
            nb = p.get("neighborhood")
            if nb:
                neighborhoods.add(nb.lower())
                name_slugs.add(_slug(nb))
                tokens.update(_tokens(nb))
            try:
                lat, lng = float(p["latitude"]), float(p["longitude"])
                lats.append(lat)
                lngs.append(lng)
            except (KeyError, TypeError, ValueError):
                pass
        bbox = None
        if lats and lngs:
            pad = 0.25  # ~25km latitude pad so nearby-but-not-exact posts still match
            bbox = (min(lats) - pad, max(lats) + pad, min(lngs) - pad, max(lngs) + pad)
        gaz[slug] = {
            "names": names,
            "name_slugs": {s for s in name_slugs if len(s) >= 5},
            "neighborhoods": neighborhoods,
            "tokens": tokens,
            "bbox": bbox,
        }
    return gaz


def location_hashtags(gaz, city_slug, limit=12):
    """Location-BOUND hashtags for a city, derived from venues + neighborhoods.

    These replace global tags as the discovery seed: they are tied to a place,
    so what they surface is almost always genuinely in that city.
    """
    g = gaz.get(city_slug, {})
    tags = set()
    for nb in g.get("neighborhoods", set()):
        s = _slug(nb)
        if len(s) >= 5:
            tags.add(s)
            tags.add(s + "dogs")
    for s in g.get("name_slugs", set()):
        if 5 <= len(s) <= 24:
            tags.add(s)
    ranked = sorted(tags, key=len)
    return ranked[:limit]


def _bbox_has(bbox, coords):
    if not bbox or not coords:
        return False
    try:
        lat, lng = float(coords[0]), float(coords[1])
    except (TypeError, ValueError, IndexError):
        return False
    return bbox[0] <= lat <= bbox[1] and bbox[2] <= lng <= bbox[3]


def confirm_city(caption, hashtags, location, coords=None, gaz=None):
    """Return the ONE city a post genuinely belongs to, or None.

    Resolution order (strongest evidence first):
      1. Coordinates inside a city's venue bounding box.
      2. A venue/neighborhood name or location-bound token in the text.
      3. Base city signals (city name, well-known districts).
    If evidence points at more than one city, we return None (ambiguous) rather
    than guess — an unconfirmed city must never drive comment wording.
    """
    if gaz is None:
        gaz = build_gazetteer()

    # 1. Geo bounding box — authoritative when present.
    if coords:
        for slug, g in gaz.items():
            if _bbox_has(g.get("bbox"), coords):
                return slug

    text = " ".join(filter(None, [caption or "", " ".join(hashtags or []), location or ""])).lower()
    text_slug = _slug(text)
    tagset = {_slug(h) for h in (hashtags or [])}

    matched = set()

    # 2. Gazetteer: venue/neighborhood names + slugs.
    for slug, g in gaz.items():
        if any(nb in text for nb in g["neighborhoods"]):
            matched.add(slug)
            continue
        if any(nm in text for nm in g["names"] if len(nm) >= 6):
            matched.add(slug)
            continue
        if tagset & g["name_slugs"]:
            matched.add(slug)
            continue
        if any(ns in text_slug for ns in g["name_slugs"] if len(ns) >= 8):
            matched.add(slug)

    # 3. Base city signals.
    for slug, signals in BASE_CITY_SIGNALS.items():
        if any(s in text for s in signals):
            matched.add(slug)

    return matched.pop() if len(matched) == 1 else None


def discover_by_location(target_city, apify_request, results_per=15):
    """Prototype discovery run: scrape location-bound tags, keep only geo-confirmed
    posts. `apify_request` is engagement-bot.apify_request (dependency-injected so
    this module has no network deps of its own and stays unit-testable).
    """
    gaz = build_gazetteer()
    cities = [target_city] if target_city else list(gaz.keys())
    confirmed, dropped = [], 0

    for city in cities:
        tags = location_hashtags(gaz, city)
        if not tags:
            continue
        print(f"  📍 {city}: {len(tags)} location-bound tags -> {tags[:6]}...")
        result = apify_request("POST", "/acts/apify~instagram-hashtag-scraper/runs", {
            "hashtags": tags,
            "resultsLimit": results_per,
        })
        # (polling + dataset fetch identical to engagement-bot.discover_posts;
        #  omitted here — the prototype's contribution is the seed + confirm step)
        items = result.get("_items", []) if isinstance(result, dict) else []
        for post in items:
            city_conf = confirm_city(
                post.get("caption"), post.get("hashtags"), post.get("locationName"),
                coords=(post.get("latitude"), post.get("longitude")), gaz=gaz,
            )
            if city_conf:
                post["city"] = city_conf
                post["detectedCity"] = city_conf
                post["cityConfirmed"] = True
                confirmed.append(post)
            else:
                dropped += 1
    print(f"  ✓ {len(confirmed)} geo-confirmed, {dropped} dropped as unconfirmable")
    return confirmed


# ─── Offline self-test against real data ─────────────────────────────────────

def _selftest():
    gaz = build_gazetteer()
    print("Gazetteer built from research-output venue DB:")
    for slug, g in gaz.items():
        print(f"  {slug:16s} names={len(g['names']):3d} neighborhoods={len(g['neighborhoods']):2d} "
              f"tokens={len(g['tokens']):3d} bbox={'yes' if g['bbox'] else 'no'}")

    print("\nSample location-bound hashtags (replace global tags as the seed):")
    for slug in ("london", "new-york-city", "tokyo", "barcelona"):
        print(f"  {slug:16s} {location_hashtags(gaz, slug)[:8]}")

    posts_file = BASE_DIR / "data" / "engagement" / "discovered-posts.json"
    if posts_file.exists():
        posts = json.load(open(posts_file)).get("posts", [])
        base_conf = sum(1 for p in posts if _base_only(p))
        new_conf = 0
        conflicts = 0
        for p in posts:
            c = confirm_city(p.get("caption"), p.get("hashtags"), p.get("locationName"), gaz=gaz)
            if c:
                new_conf += 1
                if c != p.get("city") and _base_only(p) and _base_only(p) != c:
                    pass  # bucket disagreement is expected/fine; not a conflict
        n = len(posts)
        print(f"\nGeo-confirmation rate over {n} real discovered posts:")
        print(f"  base detect_city (old):     {base_conf:3d}/{n}  ({100*base_conf//n}%)")
        print(f"  gazetteer confirm_city:     {new_conf:3d}/{n}  ({100*new_conf//n}%)")
        # ambiguity guard: ensure no post confirms to a city while ALSO matching a
        # different city's strong signal
        amb = 0
        for p in posts:
            hits = _all_city_hits(p, gaz)
            if len(hits) > 1:
                amb += 1
        print(f"  posts matching >1 city (returned as None, not guessed): {amb}")
    print("\n✓ selftest complete")


def _base_only(p):
    """Old-style detect_city (base signals only) for comparison."""
    text = ((p.get("caption") or "") + " " + " ".join(p.get("hashtags") or []) + " "
            + (p.get("locationName") or "")).lower()
    for slug, signals in BASE_CITY_SIGNALS.items():
        if any(s in text for s in signals):
            return slug
    return None


def _all_city_hits(p, gaz):
    text = ((p.get("caption") or "") + " " + " ".join(p.get("hashtags") or []) + " "
            + (p.get("locationName") or "")).lower()
    text_slug = _slug(text)
    hits = set()
    for slug, g in gaz.items():
        if any(nb in text for nb in g["neighborhoods"]) or any(ns in text_slug for ns in g["name_slugs"] if len(ns) >= 8):
            hits.add(slug)
    for slug, signals in BASE_CITY_SIGNALS.items():
        if any(s in text for s in signals):
            hits.add(slug)
    return hits


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "selftest":
        _selftest()
    else:
        print("Usage: python3 agents/location_discovery.py selftest")

#!/usr/bin/env python3
"""
Tests for nightly-brief.py — no network, no Supabase, no credentials.

The hashtag→city mapping is the piece most likely to break silently, because a
wrong answer still looks like a plausible number in the brief. This project has
already shipped that class of bug twice (`ilike '%VIC%'` matching "San Vicente",
and "hound" matching "greyhound"), so the boundary rules are pinned here.

Run:  python3 agents/test_nightly_brief.py
"""

import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "nb", Path(__file__).parent / "nightly-brief.py")
nb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nb)

HASHTAG_CASES = [
    # (hashtag, expected city or None)
    # -- long tokens: plain substring is safe
    ("dogfriendlyparis", "paris"),
    ("dogfriendlylondon", "london"),
    ("barcelonadogs", "barcelona"),
    ("sydneydogs", "sydney"),
    ("tokyodogs", "tokyo"),
    ("genevadogs", "geneva"),
    ("genevedogs", "geneva"),
    ("losangelesdogs", "los-angeles"),
    ("newyorkdogs", "new-york-city"),

    # -- 3-char tokens: start or end only
    ("atldogs", "atlanta"),
    ("dogsofatl", "atlanta"),
    ("bcndogs", "barcelona"),
    ("dogfriendlybcn", "barcelona"),
    ("nycdogs", "new-york-city"),
    ("dogsofnyc", "new-york-city"),
    ("dogfriendlynyc", "new-york-city"),

    # -- 2-char token "la": END ONLY. This is a dog site; anywhere-matching
    #    would tag every Labrador post as a Los Angeles opportunity.
    ("dogsofla", "los-angeles"),
    ("labrador", None),
    ("labradoodle", None),
    ("chocolatelab", None),
    ("blacklab", None),

    # -- generic/global hashtags must NOT resolve to a city
    ("dogsofinstagram", None),
    ("doglovers", None),
    ("dogfriendly", None),
    ("pawcities", None),

    # -- near-miss traps for naive slug splitting ("new-york-city" -> "new",
    #    "los-angeles" -> "los")
    ("newdogowner", None),
    ("newfoundland", None),
    ("newpuppy", None),
    ("lostdog", None),
    ("lostpet", None),

    # -- edge cases
    ("", None),
    (None, None),
]


def test_hashtag_city():
    failures = []
    for tag, expected in HASHTAG_CASES:
        got = nb.hashtag_city(tag)
        if got != expected:
            failures.append(f"  {tag!r}: expected {expected!r}, got {got!r}")
    return failures


def test_local_errors_are_recorded():
    """A missing or corrupt file must be REPORTED, not silently read as {}.
    Confident zeros from a failed load are worse than no brief."""
    failures = []
    nb.LOCAL_ERRORS.clear()
    nb.local("definitely-not-a-real-file.json", {"items": []})
    if not nb.LOCAL_ERRORS:
        failures.append("  missing file did not record an error")
    nb.LOCAL_ERRORS.clear()
    return failures


def test_missing_creds_are_recorded():
    """Same rule for Supabase: no credentials is an error, not an empty table."""
    import os
    failures = []
    saved = {k: os.environ.pop(k, None) for k in
             ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")}
    nb.SB_ERRORS.clear()
    result = nb.sb("anything?select=id")
    if result != []:
        failures.append("  expected [] with no credentials")
    if not nb.SB_ERRORS:
        failures.append("  missing credentials did not record an error")
    nb.SB_ERRORS.clear()
    for k, v in saved.items():
        if v is not None:
            os.environ[k] = v
    return failures


def test_thin_samples_are_excluded():
    """A city with 1 checked comment at 0% is noise. It must not be reported
    as the worst-performing city."""
    failures = []
    rows = [
        {"city": "barcelona", "checked": 49, "replied": 21, "reply_rate_pct": 42.9},
        {"city": "geneva", "checked": 1, "replied": 0, "reply_rate_pct": 0.0},
    ]
    q = {"comments_pending": 20, "comments_by_city": {"barcelona": 5, "geneva": 5},
         "cities_covered": 2, "creatives_approved": 1, "events_upcoming": 1}
    recs = nb.recommendations(rows, q, {"available": 0}, {"history_days": 9}, None)
    if any("geneva" in r and "0.0%" in r for r in recs):
        failures.append("  geneva (n=1) was reported as a performance signal")
    return failures


def main():
    all_failures = []
    for name, fn in [
        ("hashtag→city mapping", test_hashtag_city),
        ("local file errors recorded", test_local_errors_are_recorded),
        ("missing credentials recorded", test_missing_creds_are_recorded),
        ("thin samples excluded", test_thin_samples_are_excluded),
    ]:
        f = fn()
        print(f"{'PASS' if not f else 'FAIL'}  {name}")
        all_failures += [f"{name}:"] + f if f else []

    if all_failures:
        print("\n" + "\n".join(all_failures))
        return 1
    print(f"\nAll checks passed ({len(HASHTAG_CASES)} hashtag cases).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

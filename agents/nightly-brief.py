#!/usr/bin/env python3
"""
PawCities Nightly Brief — the one job that reads across everything.

WHY THIS EXISTS
---------------
Each agent optimises its own metric: discovery counts targets found, posting
counts comments sent, creative counts images made. Nothing looked across them,
so nothing could answer the only question that matters — "is any of this
working, and where should tomorrow's effort go?"

The 2026-08-19/20 audit showed the cost of that: 2,063 comments and 404 posts
had produced 81 followers, a reply rate recorded as 0% was actually 23.5%, reach
was never collected, 76 pages were serving 404s to Google, and two agents were
running daily while producing nothing usable.

This brief ranks tomorrow's targets by evidence rather than rotation, and prints
what changed since yesterday. It is READ-ONLY — it never posts, follows, or
queues anything. Discovery and posting stay where they are.

DATA IT JOINS
-------------
  Supabase  social_posts          Instagram reach / likes / saves per post
            account_snapshots     follower time series
            follower_events       gained/lost + engagement attribution
            engagement_queue      cloud comment queue
            social_opportunities  hashtag outreach finds
            events, establishments, subscribers
  Local     comment-queue.json    the live comment queue (source of truth)
            reply-tracker.json    reply outcomes by city
            follower-snapshots.json
            warm-leads-*.json     accounts that replied but don't follow

Usage:  python3 agents/nightly-brief.py [--json]
"""

import json
import os
import sys
import urllib.request
import urllib.error
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENG = ROOT / "data" / "engagement"
CITIES = ["barcelona", "paris", "london", "sydney", "atlanta",
          "los-angeles", "new-york-city", "tokyo", "geneva"]

# How each city appears inside a hashtag. Do NOT derive these by splitting the
# slug on "-": that yields "new" for new-york-city and "los" for los-angeles,
# which match #newdogowner and #lostdog. This project has already shipped that
# substring bug twice (ilike '%VIC%' matched "San Vicente"; "hound" matched
# "greyhound"), so the mapping is explicit.
CITY_HASHTAG_TOKENS = {
    "barcelona": ["barcelona", "bcn"],
    "paris": ["paris"],
    "london": ["london"],
    "sydney": ["sydney"],
    "atlanta": ["atlanta", "atl"],
    "los-angeles": ["losangeles", "la"],
    "new-york-city": ["newyork", "nyc"],
    "tokyo": ["tokyo"],
    "geneva": ["geneva", "geneve"],
}


# Slug variants that accumulated across discovery paths. Without this the
# brief splits one city's reply rate in two — "new-york 0.0% (0/7)" reads as a
# dead market when those comments belong to new-york-city.
CITY_ALIASES = {
    "new_york": "new-york-city", "new-york": "new-york-city",
    "newyork": "new-york-city", "nyc": "new-york-city",
    "los_angeles": "los-angeles", "losangeles": "los-angeles", "la": "los-angeles",
}


def canon_city(city):
    if not city:
        return None
    c = str(city).strip().lower()
    return CITY_ALIASES.get(c, c)


def hashtag_city(tag):
    """
    Return the city a hashtag belongs to, or None.

    Hashtags have no separators, so "contains" is unsafe for short tokens.
    Rules, tightened by length:
      * 2 chars ("la")      — end of tag ONLY. Anywhere-matching would make
                              every #labrador post an LA opportunity, and this
                              is a dog site. #dogsofla still resolves.
      * 3 chars ("atl")     — start or end. Covers #atldogs and #dogsofatl
                              without matching mid-word.
      * 4+ ("barcelona")    — long enough that "contains" is safe.
    """
    t = (tag or "").lower()
    if not t:
        return None
    for city, tokens in CITY_HASHTAG_TOKENS.items():
        for tok in tokens:
            if len(tok) == 2:
                if t.endswith(tok):
                    return city
            elif len(tok) == 3:
                if t.startswith(tok) or t.endswith(tok):
                    return city
            elif tok in t:
                return city
    return None


# ─── env + supabase ───────────────────────────────────────────────────────────

def _load_env():
    for name in (".env.local", ".env.instagram"):
        p = ROOT / name
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


SB_ERRORS = []


def sb(path):
    """
    GET from Supabase REST.

    Returns [] on failure so one bad table can't crash the brief — but records
    the error in SB_ERRORS and the brief prints them. Silently returning [] is
    how the insights bug hid for four months; an empty section must be
    distinguishable from a section that failed to load.
    """
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        # Not "no data" — no credentials. A brief full of confident zeros
        # because an env var went missing is worse than no brief at all.
        msg = "Supabase credentials missing (SUPABASE_URL / SERVICE_ROLE_KEY)"
        if msg not in SB_ERRORS:
            SB_ERRORS.append(msg)
        return []
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except Exception as e:  # noqa: BLE001 - report, never crash
        SB_ERRORS.append(f"{path.split('?')[0]}: {type(e).__name__} {str(e)[:70]}")
        return []


LOCAL_ERRORS = []


def local(name, default=None):
    """Read a local JSON store, recording — never hiding — a failure."""
    try:
        return json.loads((ENG / name).read_text())
    except FileNotFoundError:
        LOCAL_ERRORS.append(f"{name}: not found")
    except json.JSONDecodeError as e:
        LOCAL_ERRORS.append(f"{name}: corrupt JSON (line {e.lineno})")
    except OSError as e:
        LOCAL_ERRORS.append(f"{name}: {type(e).__name__}")
    return default if default is not None else {}


def parse_dt(v):
    if not v:
        return None
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# ─── sections ─────────────────────────────────────────────────────────────────

def audience():
    """Follower trend. The only number that says whether growth is happening."""
    snaps = sb("account_snapshots?select=*&order=captured_on.desc&limit=8")
    if not snaps:
        return {"error": "no snapshots — is /api/cron/account-snapshot running?"}
    latest = snaps[0]
    out = {
        "followers": latest.get("followers_count"),
        "following": latest.get("follows_count"),
        "posts": latest.get("media_count"),
        "delta_1d": latest.get("followers_delta"),
        "as_of": latest.get("captured_on"),
        "history_days": len(snaps),
    }
    if len(snaps) >= 7:
        out["delta_7d"] = (latest.get("followers_count") or 0) - (snaps[6].get("followers_count") or 0)
    return out


def reach():
    """Instagram distribution. Content quality was never the issue — reach was."""
    posts = sb("social_posts?select=reach,likes,comments_count,saves,format,city,posted_at"
               "&order=posted_at.desc&limit=60")
    # reach == 0 is not a measurement. Insights were blocked by a missing Meta
    # permission until 2026-08-20 and the cron wrote 0 for every post; those
    # rows would drag the average to ~0 and inflate engagement rate past 100%.
    # Only rows with real reach count.
    measured = [p for p in posts if (p.get("reach") or 0) > 0]
    unmeasured = len([p for p in posts if (p.get("reach") or 0) == 0])
    if not measured:
        return {"error": "no reach data — insights permission may have lapsed"}
    total_reach = sum(p.get("reach") or 0 for p in measured)
    total_likes = sum(p.get("likes") or 0 for p in measured)
    by_fmt = defaultdict(lambda: [0, 0])
    for p in measured:
        f = p.get("format") or "?"
        by_fmt[f][0] += p.get("reach") or 0
        by_fmt[f][1] += 1
    return {
        "posts_measured": len(measured),
        "posts_without_reach": unmeasured,
        "thin_sample": len(measured) < 10,
        "avg_reach": round(total_reach / len(measured), 1),
        "total_reach": total_reach,
        # Likes / reach. Runs well above the 1-3% industry norm, which is the
        # case for the content being fine and distribution being the constraint.
        "engagement_rate_pct": round(100 * total_likes / total_reach, 1) if total_reach else None,
        "avg_reach_by_format": {k: round(v[0] / v[1], 1) for k, v in sorted(
            by_fmt.items(), key=lambda x: -x[1][0] / max(x[1][1], 1))},
        "best_post": max(measured, key=lambda p: p.get("reach") or 0).get("reach"),
    }


def engagement_by_city():
    """
    Reply rate per city — the sharpest targeting signal available.
    Barcelona ran 42.9% while Tokyo ran 0%; rotation-based targeting cannot see
    that difference, so it kept spending equally on both.
    """
    tracker = local("reply-tracker.json", {"comments": []})
    v2 = [c for c in tracker.get("comments", []) if c.get("checker") == "browser_v2"]
    checked, replied = Counter(), Counter()
    for c in v2:
        city = canon_city(c.get("city"))
        if not city:
            continue
        checked[city] += 1
        if c.get("replies"):
            replied[city] += 1
    rows = []
    for city in CITIES:
        n = checked.get(city, 0)
        if not n:
            continue
        rows.append({
            "city": city,
            "checked": n,
            "replied": replied.get(city, 0),
            "reply_rate_pct": round(100 * replied.get(city, 0) / n, 1),
        })
    rows.sort(key=lambda r: -r["reply_rate_pct"])
    return rows


def queue_health():
    """Is there anything to post tomorrow, and is it spread across cities?"""
    q = local("comment-queue.json", {"items": []})
    pending = [i for i in q.get("items", []) if i.get("status") == "pending"]
    by_city = Counter(canon_city(i.get("city")) for i in pending)
    creatives = sb("creative_queue?select=status&status=eq.approved")
    upcoming = sb("events?select=id&status=eq.APPROVED&start_date=gte."
                  + datetime.now(timezone.utc).date().isoformat())
    return {
        "comments_pending": len(pending),
        "comments_by_city": dict(by_city),
        "cities_covered": len([c for c in CITIES if by_city.get(c)]),
        "creatives_approved": len(creatives),
        "events_upcoming": len(upcoming),
    }


def warm_leads():
    """Accounts that replied to us and still don't follow — the warmest targets."""
    import glob
    files = sorted(glob.glob(str(ENG / "warm-leads-*.json")))
    if not files:
        return {"available": 0}
    d = json.loads(Path(files[-1]).read_text())
    remaining = [l for l in d.get("leads", []) if not l.get("followed")]
    biz = [l for l in remaining if any(
        w in l["username"] for w in
        ("pet", "dog", "vet", "groom", "bar", "pub", "store", "shop", "brew",
         "fest", "cafe", "studio", "bark", "paw", "hound"))]
    return {
        "available": len(remaining),
        "business_looking": len(biz),
        "top": [l["username"] for l in sorted(
            remaining, key=lambda x: -x.get("replies", 0))[:8]],
        "source": Path(files[-1]).name,
    }


def outreach():
    """
    Hashtag opportunities from the Meta Graph API.

    This table produced nothing between April and 2026-08-20 because the
    top_media request was missing its `limit` param and Meta rejected every
    call. Fixed and productive again — worth watching that it stays that way.

    Two limitations worth knowing before trusting this section:
      * The table keys on `hashtag`, not `city` — there is no city column.
      * Meta's hashtag search does not return the media owner, so
        `source_username` is null on every row. Only the permalink identifies
        the account, which means these need a manual open to action.

    Also: the highest-like rows are global mega-accounts (#dogsofinstagram at
    8k+ likes), not local businesses. Raw volume here is NOT comparable to
    city-targeted discovery. City-tagged hashtags are the useful subset.
    """
    new = sb("social_opportunities?select=id,hashtag,category,likes,permalink,"
             "source_username,status&status=eq.new&order=likes.desc")
    engaged = sb("social_opportunities?select=id&status=eq.engaged")
    return {
        "open_opportunities": len(new),
        # `pawcities` is in ALL_HASHTAGS (social-outreach route line 37), so our
        # own posts land in this table as "opportunities". Not prospects.
        "own_posts_counted": len([o for o in new
                                  if (o.get("hashtag") or "") == "pawcities"]),
        "engaged_all_time": len(engaged),
        "by_hashtag": dict(Counter(o.get("hashtag") for o in new if o.get("hashtag"))),
        # City-tagged hashtags (#dogfriendlyparis) are local and actionable.
        # Generic ones (#dogsofinstagram) are global noise at any like count.
        "local_opportunities": len([o for o in new if hashtag_city(o.get("hashtag"))]),
        "by_city": dict(Counter(
            hashtag_city(o.get("hashtag")) for o in new
            if hashtag_city(o.get("hashtag")))),
        "top_local": [
            {"hashtag": o.get("hashtag"), "city": hashtag_city(o.get("hashtag")),
             "likes": o.get("likes"), "url": o.get("permalink")}
            for o in new if hashtag_city(o.get("hashtag"))
        ][:4],
    }


def funnel():
    """Site side. Newsletter is the weakest number in the business."""
    subs = sb("subscribers?select=id,created_at,source")
    wk = datetime.now(timezone.utc) - timedelta(days=7)
    recent = [s for s in subs if (parse_dt(s.get("created_at")) or datetime.min.replace(
        tzinfo=timezone.utc)) > wk]
    claims = sb("business_claims?select=id,status")
    return {
        "subscribers_total": len(subs),
        "subscribers_last_7d": len(recent),
        "sources": dict(Counter(s.get("source") for s in subs)),
        "business_claims": dict(Counter(c.get("status") for c in claims)),
    }


def cross_signals(city_rows, q, out):
    """
    Findings that only appear when the sources are read TOGETHER.

    Any single agent can report its own metric. What none of them can see is,
    for example, that Paris has the second-best reply rate in the network AND an
    empty comment queue AND open local opportunities sitting unworked — three
    facts living in three different systems that jointly identify tomorrow's
    highest-leverage city.
    """
    signals = []
    by_hashtag = out.get("by_hashtag", {}) if out else {}
    for r in city_rows:
        if r["checked"] < 15:
            continue
        city = r["city"]
        queued = q["comments_by_city"].get(city, 0)
        opps = sum(v for k, v in by_hashtag.items() if hashtag_city(k) == city)
        # High-yield city being starved of work.
        if r["reply_rate_pct"] >= 25 and queued == 0:
            signals.append(
                f"{city.upper()}: {r['reply_rate_pct']}% reply rate "
                f"({r['replied']}/{r['checked']}, top tier) but ZERO comments queued"
                + (f" — and {opps} open local opportunities unworked" if opps else "")
                + ". Highest-leverage city tomorrow.")
        # Effort going where it doesn't convert.
        elif r["reply_rate_pct"] == 0 and queued > 0:
            signals.append(
                f"{city.upper()}: 0 replies from {r['checked']} checked, yet "
                f"{queued} more comment{'s' if queued != 1 else ''} queued. "
                f"Fix the copy before spending {'them' if queued != 1 else 'it'}.")
    return signals


def recommendations(city_rows, q, leads, aud, out=None, covered=()):
    """`covered` = cities already called out in CROSS-SIGNALS; skip repeating them."""
    """
    Turn the numbers into tomorrow's priorities. Deliberately conservative —
    it suggests where to spend attention, it does not act.
    """
    recs = []
    # Advice derived from a source that failed to load is fabrication. Skip it.
    queue_ok = not any("comment-queue" in e for e in LOCAL_ERRORS)
    replies_ok = not any("reply-tracker" in e for e in LOCAL_ERRORS)
    # Only compare cities with enough checks to mean anything. Geneva sitting at
    # 0% off a single checked comment is noise, not a signal.
    MIN_SAMPLE = 15
    solid = [r for r in city_rows if r["checked"] >= MIN_SAMPLE] if replies_ok else []
    if len(solid) >= 2:
        best, worst = solid[0], solid[-1]
        if best["reply_rate_pct"] >= 2 * max(worst["reply_rate_pct"], 1):
            gap = (f"{best['reply_rate_pct'] / worst['reply_rate_pct']:.1f}x"
                   if worst["reply_rate_pct"] > 0 else "no replies at all there")
            recs.append(
                f"Weight discovery toward {best['city']} ({best['reply_rate_pct']}% of "
                f"{best['checked']}) over {worst['city']} ({worst['reply_rate_pct']}% of "
                f"{worst['checked']}) — {gap}.")
        dead = [r for r in solid if r["replied"] == 0 and r["city"] not in covered]
        for d in dead:
            recs.append(
                f"{d['city']}: 0 replies from {d['checked']} checked — review comment quality before spending more there.")
    if leads.get("available"):
        recs.append(
            f"{leads['available']} warm leads unfollowed ({leads['business_looking']} businesses) — "
            f"higher yield than cold discovery. Cap ~20/day.")
    if queue_ok and q["comments_pending"] < 15:
        recs.append(
            f"Only {q['comments_pending']} comments queued across {q['cities_covered']}/9 cities — "
            f"tomorrow's sessions will run dry without a discovery sweep.")
    thin = ([c for c in CITIES if not q["comments_by_city"].get(c) and c not in covered]
            if queue_ok else [])
    if thin:
        recs.append(f"No queue at all for: {', '.join(thin)}.")
    if out and out.get("local_opportunities", 0) >= 3:
        recs.append(
            f"{out['local_opportunities']} city-tagged hashtag opportunities are open "
            f"(of {out['open_opportunities']} total — the rest are global hashtags "
            f"worth ignoring). This feed only came back online today.")
    # Same rule: only comment on the follower trend if snapshots actually loaded.
    if isinstance(aud, dict) and not aud.get("error") and aud.get("history_days", 0) < 3:
        recs.append("Follower history is under 3 days — growth trend not yet meaningful.")
    return recs


# ─── render ───────────────────────────────────────────────────────────────────

def main():
    _load_env()
    aud, rch = audience(), reach()
    city_rows, q = engagement_by_city(), queue_health()
    leads, out, fun = warm_leads(), outreach(), funnel()
    xsig = cross_signals(city_rows, q, out)
    covered = {c for c in CITIES if any(c.upper() in sg for sg in xsig)}
    recs = recommendations(city_rows, q, leads, aud, out, covered)

    if "--json" in sys.argv:
        print(json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "audience": aud, "reach": rch, "engagement_by_city": city_rows,
            "queue": q, "warm_leads": leads, "outreach": out, "funnel": fun,
            "cross_signals": xsig, "recommendations": recs,
            "errors": SB_ERRORS + LOCAL_ERRORS,
        }, indent=1))
        return 1 if (SB_ERRORS or LOCAL_ERRORS) else 0

    W = 66
    print("\n" + "=" * W)
    print(f"  PAW CITIES — NIGHTLY BRIEF   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * W)

    print("\nAUDIENCE")
    if aud.get("error"):
        print(f"  ⚠️  {aud['error']}")
    else:
        d1 = aud.get("delta_1d")
        d7 = aud.get("delta_7d")
        print(f"  followers {aud['followers']}"
              + (f"  ({d1:+d} today)" if isinstance(d1, int) else "  (first day)")
              + (f"  ({d7:+d} 7d)" if isinstance(d7, int) else ""))
        print(f"  following {aud['following']}   posts {aud['posts']}")

    print("\nINSTAGRAM REACH")
    if rch.get("error"):
        print(f"  ⚠️  {rch['error']}")
    else:
        print(f"  avg reach {rch['avg_reach']} over {rch['posts_measured']} posts"
              f"   best {rch['best_post']}")
        print(f"  engagement rate {rch['engagement_rate_pct']}%  "
              f"(1-3% is typical — the constraint is reach, not content)")
        if rch.get("thin_sample"):
            print(f"  ⚠️  only {rch['posts_measured']} posts have real reach — "
                  f"{rch['posts_without_reach']} predate the insights fix and are "
                  f"excluded. Treat as directional until ~2 weeks accumulate.")
        fmts = ", ".join(f"{k} {v}" for k, v in list(rch["avg_reach_by_format"].items())[:4])
        print(f"  by format: {fmts}")

    print("\nREPLY RATE BY CITY")
    if not city_rows:
        print("  no v2-checked comments yet — run growth-tracker replies sweep")
    for r in city_rows:
        bar = "█" * int(r["reply_rate_pct"] / 3)
        print(f"  {r['city']:<15} {r['reply_rate_pct']:>5.1f}%  "
              f"({r['replied']}/{r['checked']}) {bar}")

    print("\nTOMORROW'S QUEUE")
    print(f"  comments pending {q['comments_pending']} across {q['cities_covered']}/9 cities")
    print(f"  creatives approved {q['creatives_approved']}   events upcoming {q['events_upcoming']}")

    print("\nWARM LEADS")
    print(f"  {leads.get('available', 0)} replied but don't follow "
          f"({leads.get('business_looking', 0)} businesses)")
    if leads.get("top"):
        print(f"  next: {', '.join(leads['top'][:6])}")

    print("\nOUTREACH / FUNNEL")
    print(f"  open hashtag opportunities {out['open_opportunities']}"
          f"   (engaged all-time {out['engaged_all_time']})")
    if out.get("by_hashtag"):
        print("  " + ", ".join(f"#{k} {v}" for k, v in sorted(
            out["by_hashtag"].items(), key=lambda x: -x[1])[:5]))
    if out.get("own_posts_counted"):
        print(f"  ({out['own_posts_counted']} are #pawcities — our own posts, not prospects)")
    print(f"  of those, {out['local_opportunities']} are city-tagged "
          f"(the rest are global hashtags — low local value)")
    for t in out.get("top_local", [])[:3]:
        print(f"    #{t['hashtag']:<22} {str(t['likes']):>5} likes  {t['url']}")
    print(f"  subscribers {fun['subscribers_total']} (+{fun['subscribers_last_7d']} this week)"
          f"   claims {fun['business_claims']}")

    if SB_ERRORS or LOCAL_ERRORS:
        print("\nDATA NOT LOADED  (sections above are incomplete)")
        for e in SB_ERRORS + LOCAL_ERRORS:
            print(f"  ⚠️  {e}")

    if xsig:
        print("\nCROSS-SIGNALS  (only visible across systems)")
        for sgl in xsig:
            print(f"  ▸ {sgl}")

    print("\nPRIORITIES")
    if not recs:
        print("  nothing flagged.")
    for i, r in enumerate(recs, 1):
        print(f"  {i}. {r}")
    print("\n" + "=" * W + "\n")
    # Non-zero exit so a scheduled run that silently lost a data source is
    # visible to whatever is watching, instead of looking like a healthy report.
    return 1 if (SB_ERRORS or LOCAL_ERRORS) else 0


if __name__ == "__main__":
    sys.exit(main() or 0)

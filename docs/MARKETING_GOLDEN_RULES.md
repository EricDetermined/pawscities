# PawCities Marketing & Social — Golden Rules

> These rules are also saved as the `pawcities-marketing` Claude skill, which loads
> automatically for any session working on PawCities social/marketing. This file is the
> version-controlled copy. Keep both in sync.

PawCities (@thepawcities, pawcities.com) is a dog-friendly city guide across 9 cities
(Los Angeles, New York, London, Paris, Barcelona, Geneva, Tokyo, Sydney, Atlanta).
Instagram is the primary growth funnel: it tags dog-friendly businesses so they discover
us and claim their free listing, drives dog owners to individual event/place pages on
pawcities.com, and makes those pages searchable. A sloppy feed loses the trust of both
communities and businesses. These rules are non-negotiable. If a change would break one,
don't ship it.

## The golden rules (never violate)

1. **Timeliness — a 3-day lead floor on every event.** Never post an event with under 3
   days' notice. Past, same-day, and <3-days-out events are rejected, never posted.
   Promote soonest-deadline first; if more events hit their last promotable day than
   normal capacity, post more that day (capped ~8). Never post an event with no date.
2. **Every event post carries date + venue + city + link ON THE IMAGE** (the dated event
   card, never a plain mascot illustration). A dog owner must be able to plan from the
   image alone. Mascots are for content-bank posts only.
3. **Every event caption is complete:** tease is fine, but include the date, the
   venue/location, and the specific link `pawcities.com/events/<slug>` (not just the city
   page), plus the business @tags. Drive traffic to the individual event page every time.
4. **Tag EVERY business featured, not just the source** — organizer, host, venue,
   sponsors, participating businesses. Resolve via our establishments DB → Google Places →
   website scrape → web search. Cap ~8. This is the core funnel and also grows our
   business + handle database.
5. **Coverage: every event gets its own individual post,** not just the weekly roundup.
6. **Content-bank posts must be in season.** Seasonal/dated tips (Sant Joan, Bastille,
   Halloween, Inunohi, summer heat, winter salt, pollen, tick season) only post in-window,
   hemisphere-aware (Sydney is southern). Evergreen facts post any time.
7. **Weekly roundups are "this week" only** — post within ~3 days of the week start.
8. **Account safety first** (flagged Aug 2026): safety gate + session lock + `ig-lock`,
   one actor at a time, paced, modest feed volume (ceiling ~8/day).
9. **Brand voice:** warm, human, specific, never robotic. No em dashes in customer copy.
   No hashtag walls. Never post filler.

## The funnel

Discover (Apify Google/Eventbrite cron; Instagram discovery; EU browser sweep for
Paris/Barcelona/Geneva) → ingest_queue → process-ingest vets (future-dated, dog-relevant,
deduped) + auto-generates one dated creative per event → enrich handles (venue + all named
businesses) + details (no venue = blocked as `needs_details`) → approve in time to clear
the 3-day floor (watchdog flags events within 4 days still PENDING) → post soonest-first,
dated, fully-captioned, business-tagged, in-season, paced → convert (business tags + email/
DM claim invites → claimed listings → subscribers; event/place pages drive SEO) → measure
on `/admin/marketing` (`/api/admin/outreach-funnel`) with the daily fleet-watchdog report.

## Where the rules live in code (keep intact)

- `src/app/api/cron/social-post/route.ts` — 3-day lead floor, soonest-first, deadline
  volume, stale-roundup/creative guards, never-zero fallback respecting the floor.
- `src/app/api/admin/creatives/route.ts` (`generate_event`) — dated card always; resolves
  + tags all businesses; structured caption with the event-slug link.
- `src/app/api/social/event-creative/route.tsx` — the dated card (date/venue/city/CTA).
- `src/lib/social-content.ts` — `factInSeason()` + `pickNextContent()` seasonality gate.
- `src/lib/business-handles.ts` — multi-business extraction + handle resolution.
- `src/app/api/cron/weekly-roundup/route.ts` — coming-week only.

## Operating model

- Single-owner scheduled-task fleet; the fleet-watchdog checks agents + timeliness daily.
- Mac-push deploy (Claude commits, Eric pushes). Migrations via numbered Supabase SQL
  editor queries. Never hard-delete user data. Claude never enters credentials/2FA.
- Ambassadors are voluntary/commission-only; listing claims are always free.

## Pre-ship checklist (every social change)

Date on the image? Complete caption with the event-slug link? Every featured business
tagged? ≥3-day lead? Content-bank picks in season? Roundup current-week? Safety gate +
lock in place? If any answer is no, fix it before it posts.

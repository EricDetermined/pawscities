# Net-new handle discovery — the compounding growth loop

Most discovery channels mine accounts we **already** watch. This channel finds
accounts we **don't** follow yet and adds them to the watch list, so coverage
compounds over time instead of plateauing on the initial handle set.

## Why it's a browser sweep, not a server cron

`handle-discovery` (the daily server cron) uses the Instagram Graph API
`business_discovery` endpoint, which only works when you already know the
username. The Graph API's hashtag endpoints deliberately **omit the poster's
username** on hashtag media, so you cannot discover *new account handles*
server-side. Usernames are only visible in the DOM of Explore/hashtag/location
pages — so net-new handle discovery has to run in the browser.

## The loop

1. **`hashtag-location-discovery`** scheduled task (weekly, Wed) — a browser
   session that, per city, opens the hashtag pages in `hashtag-sources.json`,
   harvests post-owner handles, semantically vets them (dog event/venue/
   organizer/community for the correct city; rejects individual pets, geo
   lookalikes, competitors), and pipes the keepers to the helper below.
2. **`agents/add-watch-handles.mjs`** — normalizes, blocks self/competitors,
   dedupes against `watch_handles`, and inserts only net-new accounts with
   `source='hashtag-discovery'`, `active=true`.
3. **`handle-discovery`** (daily server cron) then mines those new accounts'
   posts for events forever — no browser needed after intake.

## Files

- `hashtag-sources.json` — per-city dog-event hashtags (and optional location
  URLs) to sweep. Tags stored without the leading `#`. Extend freely.
- `../../agents/add-watch-handles.mjs` — the dedupe+insert helper. Supports
  `--dry-run` and `--source=`. Input: JSON array of
  `{handle, city, handle_type, notes}`.

## Manual run

```
node agents/add-watch-handles.mjs candidates.json --dry-run   # preview
node agents/add-watch-handles.mjs candidates.json             # insert net-new
```

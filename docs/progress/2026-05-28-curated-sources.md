# Curated Source Scraper — May 28, 2026

## Problem Statement

The Google Events Apify scraper returns shallow data: just titles, often without dates, venues, or descriptions. The pipeline needs high-quality events with full details from trusted, curated listing sites specific to each city.

## Solution: 3-Channel Discovery Pipeline

The event discovery cron now runs 3 channels:

| Channel | Source | Quality | How it works |
|---------|--------|---------|--------------|
| 1. Instagram | Hashtag search | Variable | Scans dog hashtags, scores by keywords, optional Vision scan |
| 2. Google Events | Apify scraper | Medium | Searches Google Events, word-boundary dog filter, dynamic scoring |
| 3. **Curated Sources** | Trusted listing sites | **High** | Scrapes known sites, AI-extracts structured event data |

## Curated Sources Per City

### Los Angeles (3 sources, rotated daily)
- BringFido LA: `bringfido.com/event/city/los_angeles_ca_us/`
- Sidewalk Dog LA: `sidewalkdog.com/los-angeles-ca/events`
- Eventbrite LA Dogs: `eventbrite.com/d/ca--los-angeles/dog-events/`

### New York (2 sources)
- BringFido NYC: `bringfido.com/event/city/new_york_ny_us/`
- Eventbrite NYC Dogs: `eventbrite.com/d/ny--new-york/dog-events/`

### London (2 sources)
- The Dogvine: `thedogvine.com/whats-on/`
- Eventbrite London Dogs: `eventbrite.co.uk/d/united-kingdom--london/dog-events/`

### Paris (2 sources)
- Sortir à Paris - Chiens: `sortiraparis.com/articles/tag/sortie-chien-guide`
- BringFido France: `bringfido.com/event/country/france/`

### Barcelona (1 source)
- BringFido Barcelona: `bringfido.com/attraction/city/barcelona_es/`

### Tokyo (1 source)
- PETTENA Tokyo: `pettena.jp/blogs/pet-outings/dog-events-tokyo`

### Sydney (2 sources)
- Australian Dog Lover: `australiandoglover.com/p/2026-dog-events-australia-calendar.html`
- City of Sydney What's On: `whatson.cityofsydney.nsw.gov.au/tags/dog-friendly`

### Geneva (1 source)
- BringFido Switzerland: `bringfido.com/event/country/switzerland/`

**Total: 14 curated sources across 8 cities**

## How It Works

1. **Daily rotation**: 1 source per city per day (rotates by day-of-year)
2. **Listing page fetch**: Downloads the listing/calendar page
3. **Link extraction**: Regex-based extraction of event/article URLs matching the source's link pattern
4. **Individual page fetch**: Downloads each event page (max 6-8 per source)
5. **AI extraction**: GPT-4o-mini parses each page into structured data (name, date, venue, description, tags)
6. **Quality filter**: Skips non-dog events, past events, and non-event pages
7. **Insert into ingest_queue**: Same pipeline as other channels → process-ingest → PENDING events

## Files Created/Modified

1. **`src/lib/curated-sources.ts`** (NEW, ~300 lines)
   - Source configuration per city
   - `extractEventLinks()` — regex-based link extraction from HTML
   - `extractEventWithAI()` — GPT-4o-mini structured event extraction
   - `scrapeCuratedSource()` — full scrape pipeline for one source
   - `getTodaysSources()` — daily rotation logic

2. **`src/app/api/cron/event-discovery/route.ts`** (modified)
   - Added Channel 3 between Google Events and sort/insert
   - Updated import, summary, and response JSON
   - Sources rotate daily, max ~50 AI calls per run

3. **`supabase/migrations/013_ingest_queue_constraints.sql`** (updated)
   - Added 'curated_scrape' to allowed source values

## First Run Results

- Scraped all 8 cities (1 source each)
- Found 18 curated events
- Combined with Google Events: 72 total candidates
- 45 caught as duplicates (dedup working)
- Created 7 new PENDING events from this run
- Notable finds: "Esprit Dog Show" (Paris), "Dogs and Cats" at Cité des Sciences (Paris)

## Iteration Plan

Sources can be added/removed by editing `CURATED_SOURCES` in `src/lib/curated-sources.ts`. As we identify more reliable sites per city, we add them to the rotation. Current gaps to fill:
- Barcelona: need a local Spanish/Catalan dog event site
- Tokyo: need a second Japanese source
- Geneva: need a local French-language source

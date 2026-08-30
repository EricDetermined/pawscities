# San Diego — Launch Research Report (2026-08-30)

## Summary
110 verified dog-friendly establishments researched and compiled to
`research-output/san-diego-places.json`, matching the Atlanta launch format
(Atlanta launched with 109). Every business was verified as currently
operating; 20+ candidates were excluded as closed (see agent exclusion lists
in session history) — including several 2025-26 brewery closures.

## Coverage
restaurants 32 (incl. 16 breweries/taprooms) · parks 12 · cafes 10 ·
activities 10 · hotels 10 · shops 9 · daycare 8 · beaches 6 · vets 6
(incl. 2× 24h emergency) · trainers 4 · bakeries 3.
Neighborhoods: North Park, Ocean Beach, Pacific Beach, Little Italy, Gaslamp,
Hillcrest, La Jolla, Coronado, Liberty Station, Point Loma, Encinitas/North County.
Average confidence 85 (min 65).

## Rule caveats baked into descriptions
- Del Mar North Beach: off-leash voice control only day-after-Labor-Day → Jun 15; LEASH Jun 16–Labor Day.
- Grape Street Dog Park: NOT 24/7 (M–F 7:30am–9pm; weekends 9am–9pm). Morley Field & Nate's Point are 24h.
- Fiesta Island: leash-optional 6am–10pm; seasonal tern-nesting closures.
- Torrey Pines: NO dogs (excluded). Flagship Cruises/Coronado Ferry: service animals only (excluded).
- Hotel del Coronado: 40lb limit + breed restrictions, $150–200/stay.

## Launch checklist (when Eric green-lights, ~1-2h work)
1. Add sandiego to cities table (Supabase) + cities-config.ts (hero image, coords, timezone America/Los_Angeles) + CITY_DATA_MAP ('sandiego' → 'san-diego-places').
2. REMOVE 'san diego' from the losangeles REGION_CONFLICTS list in process-ingest and from engagement geo-lookalike vetting in all task prompts (currently rejected as an LA conflict marker).
3. Add sandiego to admin city dropdowns, CITY_LANDMARKS (mascot scenes), CITY_SCENES in mascot-library (+ generate 6 library images ~$0.40), content bank facts (~25), engagement hashtags + curated accounts.
4. Run /api/places/enrich?city=sandiego batches, then refresh-photos for photo refs.
5. Seed initial events (Surf Dog Surf-A-Thon Sept @ Del Mar, Barks & Brews, Doggie Street Festival Nov 21, brewery yappy hours).
6. Ambassador announcement creative for the SD ambassador once confirmed.

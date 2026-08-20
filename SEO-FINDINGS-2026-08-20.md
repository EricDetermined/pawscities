# SEO findings — 2026-08-20

Source: Google Search Console (`sc-domain:pawcities.com`), GA4 (property 545435029), live crawl.

---

## 1. 76 pages are serving 404 to Google

Page indexing report:

| Reason | Pages |
|---|---|
| **Not found (404)** | **76** |
| Discovered – currently not indexed | 80 |
| Crawled – currently not indexed | 13 |
| Page with redirect | 3 |
| Blocked by robots.txt | 2 |
| **Indexed** | **535** |

I originally found 3 of these via GA landing pages. Search Console says **76**. Every one is a
cancelled or past event that the page route refused to render.

Commit `8af0e5f` (unpushed) converts all 76 from 404 → 200 with a cancelled banner, live
alternatives, city links and email capture.

---

## 2. The demand is real and we are wasting it

Top queries, last 28 days:

| Query | Clicks | Impressions | CTR |
|---|---|---|---|
| paris dog week | 4 | 147 | 2.7% |
| dogs day out st ives | 4 | 91 | 4.4% |
| **ekka dog show 2026** | **3** | **924** | **0.32%** |
| wuthering heights day sydney 2026 | 2 | 251 | 0.80% |
| woofest paris 2026 | 1 | 195 | 0.51% |

**1,608 impressions → 14 clicks (0.87% CTR).**

Three of these five queries point at pages that currently 404:
`ekka dog show 2026`, `wuthering heights day sydney 2026`, `dogs day out st ives`.

**`ekka dog show 2026` alone gets 924 impressions a month and returns 3 clicks.** Google is
ranking us for genuine demand; the page then fails. That single query is the clearest
opportunity on the site — even a modest 5% CTR would be ~46 clicks/month from one query.

Note the pattern: **every top query is an event-name search.** Not "dog friendly cafes paris" —
people are searching for specific named events. That is the niche the site actually owns.

---

## 3. What this changes about priorities

The earlier plan said organic search was the biggest channel (62% of traffic). Search Console
sharpens it further:

- The traffic problem is not ranking. **We already rank** — 1,608 impressions on five queries.
- The problem is **delivery**: rank → click → 404.
- Fixing that is a code change already written and committed, not a content programme.

**Order of value:**

1. **Deploy `8af0e5f`.** Fixes 76 404s and the top-3 queries by impression.
2. **Re-submit the sitemap / request validation** in Search Console once live, so Google
   re-crawls the 76 rather than waiting.
3. **Event-page titles should match query shape.** People search `ekka dog show 2026`, not
   `Ekka Royal Queensland Show 2026 Canine — Sydney | Paw Cities`. Titles should lead with the
   name people actually type.
4. **80 "Discovered – not indexed"** — Google found them and declined. Usually thin content or
   crawl budget. Worth a look after the 404s clear, since fixing 76 dead pages should improve
   sitewide crawl trust.

---

## 4. Already healthy — don't spend time here

- `robots.txt` correct: allows all, blocks `/api/`, `/admin/`, `/profile/`, declares sitemap
- `sitemap.xml` returns 200 with **585 URLs**, well-formed
- Sampled 8 event URLs from the sitemap: **all 200** — the sitemap only lists live events
- 535 pages indexed and the trend is up (roughly 250 → 535 since late July)
- `llms.txt` present for AI crawlers
- HTTPS clean, `www` → apex redirect working

---

## 5. Still outstanding

| Item | Owner |
|---|---|
| Push `8af0e5f` (fixes the 76) | Eric — needs GitHub credentials |
| GA4 key events (`newsletter_signup` etc.) — still 0 configured | Eric |
| Link Search Console ↔ GA4 (GA is prompting for it) | Eric — 1 min |
| `pawscities.com` → 301 to `pawcities.com` (currently a parked lander) | Eric — registrar/Vercel |
| Event title format aligned to query shape | me, next release |
| Investigate 80 discovered-not-indexed | me, after 404s clear |

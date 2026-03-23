# PawCities Production Readiness Audit

**Date:** March 14, 2026
**Site:** [pawcities.com](https://pawcities.com)
**Repo:** github.com/EricDetermined/pawscities

---

## Executive Summary

PawCities has a solid foundation with a polished homepage, 8 live city pages, a complete business claim/submission flow, and fully-wired Stripe subscription code. There are four areas that need attention before "prime time": two quick visual fixes, one feature integration (weather recommendations), and Stripe configuration in the production environment.

---

## 1. Homepage & Navigation

**Status: READY**

The homepage is production-quality. The hero section with the two dogs is eye-catching, category badges (Parks, Restaurants, Cafes, Hotels, Beaches, Vets) render cleanly, and the "Explore Cities" grid shows all 8 cities with beautiful Unsplash hero images. The nav bar has the PawCities logo, "For Business" link, Sign In, and Sign Up — all functional.

**One observation:** The homepage category badges only show 6 of the 12 categories. The 3 new categories (Dog Walkers, Dog Trainers, Daycare & Boarding) plus Groomers, Pet Shops, and Activities are not shown on the homepage hero. This is fine for now — they appear on city pages — but worth adding once those categories have more listings.

---

## 2. City Pages

**Status: FUNCTIONAL with 2 visual issues**

Each city page (e.g., /geneva, /paris, /tokyo) loads correctly with:
- Hero banner with city photo, country badge, description
- Stats line (total places, parks count, restaurants count)
- Search bar with live filtering
- Category filter buttons with counts
- Grid/Map toggle (Leaflet map with markers)
- Establishment cards with ratings, price level, neighborhood, dog feature icons
- Dog Regulations section (leash policy, off-leash areas, public transport)

### Issues Found

**Issue A — Emoji encoding on category filters:** The category filter buttons show garbled characters instead of emojis (e.g., "ð ½ï¸" instead of the actual emoji). This is a UTF-8 encoding issue, likely happening during the server-side data serialization to the client component. The emojis are stored correctly in the source code (categories.ts), but get mangled in transit.

**Fix:** Ensure the category data is properly UTF-8 encoded when passed as props from the server page.tsx to the client CityPageClient.tsx. This may require checking the Next.js serialization boundary or encoding the emojis as HTML entities.

**Issue B — Establishment card images:** Some establishment cards show the alt text overlaid on the image area (e.g., "Café du Soleil" text visible at the top of the card). The Unsplash URLs appear to load, but the `<img>` tag's alt text shows briefly or the images fail for some URLs.

**Fix:** Check that the generated Unsplash image URLs in data.ts are valid. Consider adding `loading="lazy"` and an `onError` fallback to show a placeholder image. Also verify the Unsplash query parameters aren't hitting rate limits.

---

## 3. Weather-Based Recommendations

**Status: API EXISTS, NOT INTEGRATED**

The weather API at `/api/weather` is fully implemented and working. It uses Open-Meteo (free, no API key needed) and returns temperature, humidity, wind speed, condition, icon, and importantly a `suggestIndoor` boolean that triggers when:
- Weather is rain, snow, fog, drizzle, or thunderstorm
- Temperature exceeds 95°F or drops below 32°F
- Wind speed exceeds 25 mph

**What's missing:** The weather API is not called from any city page. There is no weather widget displayed, and the `suggestIndoor` flag is not used to sort or highlight indoor-friendly establishments.

### Recommended Integration

**Phase 1 — Weather widget (quick win):**
Add a weather banner at the top of each city page that fetches `/api/weather?lat={city.latitude}&lon={city.longitude}` on page load. Display: icon + temperature + condition. Example: "☀️ 72°F Clear sky — Great day for outdoor spots!"

**Phase 2 — Smart recommendations:**
When `suggestIndoor` is true, auto-filter or highlight establishments with `indoorAllowed: true`. Show a banner: "🌧️ 45°F Rain — Showing indoor-friendly spots first." Sort indoor establishments to the top of the grid.

**Phase 3 — Seasonal/time-aware:**
Use the city's timezone to show relevant suggestions. Evening in Tokyo? Highlight restaurants and cafes. Hot summer day in LA? Prioritize beaches and parks with shade. This can layer on top of the existing dog features data.

---

## 4. Business Onboarding — Adding a New Establishment

**Status: READY (full flow implemented)**

The business flow is comprehensive:

1. **Landing page** (`/for-business`) — Professional hero, value props, 3-step "How It Works", pricing cards (Free $0 vs Premium $29/mo), FAQ section. All looks polished.

2. **Claim existing listing** (`/business/claim`) — Search for your business, select it, fill out verification (6 methods: business license, domain email, Google Business, utility bill, phone verification, other). Email domain matching shows a green checkmark when the email matches the business website domain.

3. **Submit new business** — If not found in search, a "New Business" form collects: name, address, city, category, description, phone, website, and contact info. Submits to `/api/business/submit` which creates a PENDING establishment + claim.

4. **Post-claim dashboard** (`/business`) — Business owners get a dashboard with listing management, photo uploads, analytics, and reviews pages.

5. **Upgrade flow** (`/business/upgrade`) — Connects to Stripe Checkout for the $29/mo Premium tier.

**Key design decisions already in place:**
- Parks and beaches are excluded from claiming (community listings)
- New submissions are set to PENDING_REVIEW status
- Email notifications sent to both the business and admin
- Business role is auto-assigned on claim creation

**One suggestion:** The "Get Started Free" button on the for-business page goes to `/login?redirect=/business/claim`. This is correct, but consider also having a prominent "Add Your Business" or "Not listed? Add it now" CTA on city pages themselves, so business owners who discover their establishment isn't listed can easily self-submit.

---

## 5. Stripe Integration

**Status: CODE COMPLETE, needs production configuration**

The Stripe integration is thorough and well-architected:

### What's Built

| Component | Status | Details |
|-----------|--------|---------|
| Checkout route | Complete | Creates Stripe customer, checkout session with subscription mode |
| Webhook handler | Complete | Handles 5 events: checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed, invoice.payment_succeeded |
| Billing portal | Complete | Lets customers manage subscriptions via Stripe portal |
| Subscription table | Complete | Tracks status (ACTIVE/CANCELLED/PAST_DUE/TRIALING), period dates, Stripe IDs |
| Tier sync | Complete | Establishment tier auto-updates to PREMIUM on payment, back to FREE on cancellation |
| Promo codes | Enabled | `allow_promotion_codes: true` in checkout session |

### What Needs Configuration

To go live with Stripe, the following environment variables need to be set in your Vercel deployment:

1. **`STRIPE_SECRET_KEY`** — Get from Stripe Dashboard > Developers > API Keys. Use live key (sk_live_...) for production, test key (sk_test_...) for testing.

2. **`STRIPE_WEBHOOK_SECRET`** — Create a webhook endpoint in Stripe Dashboard > Developers > Webhooks pointing to `https://pawcities.com/api/stripe/webhook`. Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`. Copy the signing secret (whsec_...).

3. **`STRIPE_MONTHLY_PRICE_ID`** — Create a Product in Stripe called "PawCities Premium" with a $29/month recurring price. Copy the price ID (price_...).

4. **`STRIPE_ANNUAL_PRICE_ID`** — Add an annual price to the same product (e.g., $290/year for a ~17% discount). Copy the price ID.

### Stripe Go-Live Checklist

- [ ] Create Stripe account or activate live mode
- [ ] Create "PawCities Premium" product with monthly ($29) and annual prices
- [ ] Set up webhook endpoint pointing to pawcities.com/api/stripe/webhook
- [ ] Add all 4 Stripe env vars to Vercel
- [ ] Test the full flow: claim a business → upgrade → checkout → verify webhook fires → verify tier changes to PREMIUM
- [ ] Set up Stripe Customer Portal branding (logo, colors)
- [ ] Configure dunning emails for failed payments in Stripe settings

---

## 6. Other Findings

### Database (Supabase)
- Schema is comprehensive with 11 tables, all with RLS policies
- The 3 new categories (walkers, trainers, daycare) are live in both the schema and the migration files
- Admin views (admin_stats, city_stats) are ready for a dashboard

### Email (Resend)
- Confirmation and admin alert emails are coded for business claims
- Requires `RESEND_API_KEY` to be set in Vercel (and domain verified in Resend dashboard for noreply@pawcities.com)

### Features Not Yet Live (Future Phases)
- **Reviews system** — Schema and API exist, but no user-facing review form or display on establishment pages
- **Dog profiles** — Schema exists, minimal UI
- **Check-ins** — Schema exists, no UI
- **Favorites persistence** — Currently client-side only (resets on page reload)
- **Admin dashboard** — Routes exist but need buildout for managing claims, reviewing establishments, viewing analytics

---

## Priority Action Items

### Must-Fix Before Launch
1. **Fix emoji encoding** on city page category filters
2. **Verify establishment images** load correctly (check Unsplash URL generation)

### High-Value Quick Wins
3. **Add weather widget** to city pages (API already exists, just needs frontend integration)
4. **Add "List Your Business" CTA** on city pages for organic business signups

### Stripe Activation (When Ready)
5. **Configure Stripe** in production (create product, webhook, add env vars)
6. **Test end-to-end** payment flow in Stripe test mode first

### Future Enhancements
7. Connect weather to smart recommendations (indoor priority on bad weather days)
8. Build out review system UI
9. Persist favorites to Supabase for logged-in users
10. Admin dashboard for managing claims and moderation

# Environment variable recovery

**This file contains no secrets and never should.** It is the map, not the keys:
what every variable is for, where it was issued, and how to get a new one if the
local `.env*` files are lost. It is committed to git on purpose — so that if the
working folder is destroyed, this survives on `origin`.

Written 2026-09-21 after finding a live GitHub OAuth token in plaintext in
`.git/config`. The lesson generalised: local `.env*` files are gitignored, so
they exist in exactly one place on one machine.

---

## Where values actually live

| Location | Holds | Survives folder loss? |
|---|---|---|
| `.env.local`, `.env.engagement`, `.env.instagram` | everything the local agents use | **No** — gitignored, one copy |
| Vercel project env vars | everything the deployed site + crons use | Yes |
| Provider consoles (Supabase, OpenAI, Meta, Stripe…) | can re-issue most keys on demand | Yes |
| Your password manager | *should* hold the Instagram login (see Tier 1) | Yes |

Most keys below are **re-issuable** — losing them costs a console visit, not
data. Read the Tier sections for the handful where that isn't true.

---

## Tier 1 — put these in your password manager

These cannot simply be re-issued without consequences.

| Key | File | Why it's special |
|---|---|---|
| `IG_USERNAME` / `IG_PASSWORD` | `.env.engagement` | The real @thepawcities Instagram login. A password reset is possible but triggers Instagram security review — and this account has already been flagged once (2026-08-24). Losing or leaking this is the worst case in the repo: it is account takeover, not a service outage. |
| `CRON_SECRET` | `.env.local` | Self-chosen shared secret, not issued by anyone. If lost you must invent a new one **and** update it in Vercel and everywhere it is hardcoded (see Rotation notes). Nothing can tell you the old value. |

## Tier 2 — re-issuable, but rotation has side effects

| Key | File | Where to re-issue | Side effect |
|---|---|---|---|
| `META_APP_SECRET` | `.env.instagram` | Meta app dashboard → Settings → Basic | Invalidates existing access tokens; `META_PAGE_ACCESS_TOKEN` must be regenerated too |
| `META_PAGE_ACCESS_TOKEN` | `.env.instagram` | Meta Graph API Explorer → long-lived page token | Handle-discovery + event crons fail until replaced |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Vercel | Stripe dashboard → Developers | Webhook secret differs per endpoint; re-copy after any endpoint change |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Supabase → Project Settings → API | Full-access key; rotating invalidates every agent using it |

## Tier 3 — freely re-issuable, low drama

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`,
`STRIPE_*_PRICE_ID`.

Revoke and re-issue in the provider console. Nothing is lost but a few minutes.

## Not secrets at all

`META_APP_ID`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_ACCOUNT_ID`, `META_API_VERSION`,
`INSTAGRAM_USERNAME`, `EMAIL_FROM`, `ADMIN_EMAILS`, `NEXT_PUBLIC_*`,
`OPENAI_COMMENT_MODEL`, `OPENAI_VISION_MODEL`, `IG_SESSION_PATH`, `IG_PROXY`.

Identifiers and config. Read them off the relevant console or pick them again.

---

## Rotation notes

- **`CRON_SECRET` is hardcoded in three scheduled-task prompts** —
  `hashtag-location-discovery`, `instagram-engagement-comments`, and
  `nightly-deep-discovery` each embed it in their `POST /api/admin/alert` call.
  If you rotate it, update all three prompts or the account-safety email alerts
  will silently stop working. That is the alert that tells you Instagram has
  walled the account, so a silent failure there is expensive.
- Rotating `META_APP_SECRET` invalidates `META_PAGE_ACCESS_TOKEN`. Do them
  together and expect the discovery crons to fail until both are in place.
- After any rotation, update **both** the local `.env*` file and the Vercel
  project variable. Local agents and the deployed crons read different copies.

## If the folder is lost entirely

1. `git clone` from `origin` — recovers all code, migrations, and this file.
2. Recreate `.env.local`, `.env.engagement`, `.env.instagram` from
   `.env.example` plus this document.
3. Instagram login comes from your password manager (Tier 1).
4. `CRON_SECRET` must match what Vercel already has — read it from the Vercel
   dashboard rather than inventing a new one.
5. Gitignored engagement data (`comment-history.json`,
   `dm-invitations-log.json`, `discovered-posts.json`, session reports) is **not**
   recoverable from git. `comment-queue.json` and `reply-tracker.json` are
   mirrored to Supabase by `agents/sync-engagement.py` and can be pulled back.

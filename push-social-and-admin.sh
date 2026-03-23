#!/bin/bash
# PawCities - Push Social Media Pipeline + Admin Dashboard Updates
# Run this from the pawscities project root directory
#
# What this pushes:
#   1. Instagram auto-posting pipeline (lib, API routes, cron job)
#   2. Social Media admin page
#   3. Establishment action buttons (featured/verified/deactivate)
#   4. Supabase migration for social_posts table
#   5. Vercel cron configuration

set -e

echo "=== PawCities: Committing Social Media Pipeline + Admin Updates ==="
echo ""

# Stage all new and modified files
git add \
  src/lib/instagram.ts \
  src/lib/social-content.ts \
  src/app/api/cron/social-post/route.ts \
  src/app/api/social/publish/route.ts \
  src/app/api/social/queue/route.ts \
  src/app/api/admin/establishments/\[id\]/route.ts \
  src/app/admin/social/page.tsx \
  src/app/admin/layout.tsx \
  src/app/admin/establishments/page.tsx \
  supabase/migrations/003_social_posts.sql \
  vercel.json

echo "Staged files:"
git diff --cached --stat
echo ""

# Commit
git commit -m "feat: Instagram auto-posting pipeline + admin dashboard updates

- Add Instagram Meta Graph API client (two-step publish flow)
- Add 44-fact content bank across 8 cities with round-robin scheduling
- Add Vercel cron job for auto-posting (Mon/Wed/Fri 2PM UTC)
- Add admin Social Media page (content queue, manual publish, post history)
- Wire up establishment action buttons (featured, verified, deactivate)
- Add social_posts Supabase migration for post tracking
- Add manual publish and queue preview API endpoints"

echo ""
echo "Pushing to origin/main..."
git push origin main

echo ""
echo "=== Done! Vercel will auto-deploy from main. ==="
echo ""
echo "NEXT STEPS:"
echo "  1. Run the Supabase migration (003_social_posts.sql) in your Supabase dashboard"
echo "  2. Add these env vars in Vercel project settings:"
echo "     - META_PAGE_ACCESS_TOKEN"
echo "     - INSTAGRAM_ACCOUNT_ID (17841480713996075)"
echo "     - META_API_VERSION (v25.0)"
echo "     - CRON_SECRET (generate a random secret string)"
echo "     - SUPABASE_SERVICE_ROLE_KEY"
echo "  3. Test the cron with: curl 'https://pawcities.com/api/cron/social-post?secret=YOUR_SECRET&dryRun=true'"

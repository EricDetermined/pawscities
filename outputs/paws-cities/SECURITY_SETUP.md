# Security & GDPR Setup Guide

This guide provides step-by-step instructions for setting up the enhanced security and GDPR features in PawsCities.

## Prerequisites

- Node.js 18+
- Supabase project (tnqctocershbclhbjnwg)
- PostgreSQL database connected
- Prisma CLI installed

## Step 1: Environment Configuration

### 1.1 Update .env.local

Add these required environment variables:

```env
# Supabase (from project settings)
NEXT_PUBLIC_SUPABASE_URL=https://tnqctocershbclhbjnwg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Webhook Secret (configure in Supabase)
SUPABASE_WEBHOOK_SECRET=your_webhook_secret_here

# Application URL (for OAuth callbacks, data export, etc.)
NEXT_PUBLIC_APP_URL=https://pawscities.com  # or http://localhost:3000

# GDPR Configuration
GDPR_DATA_RETENTION_DAYS=90
GDPR_LOGS_RETENTION_DAYS=180
```

**Finding Supabase Keys:**

1. Go to Supabase Dashboard → Project Settings → API
2. Copy "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy "service_role secret" key → `SUPABASE_SERVICE_ROLE_KEY`

## Step 2: Database Migration

### 2.1 Create Migration

```bash
# Generate migration files
npx prisma migrate dev --name add_gdpr_and_security

# This creates the DataProcessingLog table for audit trails
```

### 2.2 Verify Schema

```bash
# Open Prisma Studio to verify tables
npx prisma studio
```

You should see:
- `User` table (existing)
- `DataProcessingLog` table (new)

## Step 3: Supabase Webhook Configuration

### 3.1 Create Auth Webhook in Supabase

1. Go to Supabase Dashboard → Project → Database → Webhooks
2. Click "New hook" or "Create webhook"
3. Configure:
   - **Events**: Check "auth" events
   - **Types**: Select "user.created", "user.updated", "user.deleted"
   - **HTTP endpoint**: `https://pawscities.com/api/webhooks/supabase-auth`
   - **HTTP method**: POST

### 3.2 Generate Webhook Secret

1. In Supabase Webhooks page, look for "Signing secret"
2. Copy the secret and set as `SUPABASE_WEBHOOK_SECRET`
3. Store securely in your `.env.local` file

### 3.3 Test Webhook

```bash
# Create a test user in Supabase Auth
# Check server logs for webhook event being processed
# Verify User record is created in database via Prisma Studio
```

## Step 4: Database Setup

### 4.1 Run Migrations

```bash
# Apply all pending migrations
npx prisma migrate deploy

# Or in development:
npx prisma migrate dev
```

### 4.2 Verify Tables

```bash
# Check PostgreSQL directly
psql your_database_url

# List tables
\dt

# Check DataProcessingLog table
\d data_processing_log
```

## Step 5: Install Dependencies

Ensure all dependencies are installed:

```bash
npm install

# Specific dependencies that are used:
# - @supabase/supabase-js (already installed)
# - @prisma/client (already installed)
# - lucide-react (already installed) - for Privacy page icons
```

## Step 6: Generate Prisma Client

```bash
# Generate Prisma client
npx prisma generate

# Verify no errors
npm run type-check
```

## Step 7: Configure Security Headers

The security headers are automatically configured via `src/lib/security-config.ts`. To apply them to Next.js responses, add to `next.config.js`:

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

## Step 8: Test GDPR Endpoints

### 8.1 Authenticate

```bash
# Login to get auth token
# Token will be in response or in cookies/localStorage

# Or use Supabase CLI:
npx supabase start
```

### 8.2 Test Endpoints

```bash
# Test 1: Get Consent
curl -X GET http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 OK with current consent preferences

# Test 2: Update Consent
curl -X POST http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"analytics": true, "marketing": false}'

# Expected: 200 OK with updated consents

# Test 3: Export Data
curl -X GET http://localhost:3000/api/gdpr/export \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 OK with JSON file download

# Test 4: Check Deletion Status
curl -X GET http://localhost:3000/api/gdpr/delete \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 OK with account status

# Test 5: Get Audit Trail
curl -X GET "http://localhost:3000/api/gdpr/audit-trail?days=30" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 OK with audit trail events
```

## Step 9: Test Rate Limiting

```bash
# Test rate limiting (make 6+ rapid requests to login)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login-event \
    -H "Content-Type: application/json" \
    -d '{"userId":"test","provider":"email","isFirstLogin":false}'
done

# Expected: 5th request succeeds, 6th returns 429 (rate limited)
```

## Step 10: Update Privacy Policy

Create or update Privacy Policy to mention:
- GDPR compliance features
- Data processing practices
- User rights (Article 15, 17, 20)
- Cookie usage
- Data retention periods
- Contact for privacy requests

Add link to `/profile/privacy` for users to manage preferences.

## Step 11: Production Deployment

### 11.1 Environment Variables

Set these in production environment:
- All variables from Step 1
- Use production Supabase project URL and keys
- Set `NEXT_PUBLIC_APP_URL` to your production domain

### 11.2 Database Connection

```bash
# Use production database URL
# Test connection before deploying
npx prisma db execute --stdin < test_connection.sql
```

### 11.3 Run Migrations

```bash
# In production (CI/CD):
npx prisma migrate deploy
```

### 11.4 Enable HTTPS

Ensure all endpoints use HTTPS with valid SSL certificate.

### 11.5 Security Headers

Verify headers are applied:
```bash
curl -I https://pawscities.com/
# Should see security headers in response
```

## Step 12: Monitoring & Maintenance

### 12.1 Monitor Audit Trail

```bash
# Periodically check audit logs
# Example: Get users who've requested data export
npx prisma client raw execute --stdin << 'EOF'
SELECT userId, eventType, COUNT(*) as count
FROM data_processing_log
WHERE "eventType" = 'export'
GROUP BY userId, eventType
ORDER BY COUNT(*) DESC;
EOF
```

### 12.2 Data Cleanup

```bash
# Remove old audit logs (run monthly)
# Example: Delete logs older than 180 days

npx prisma client raw execute --stdin << 'EOF'
DELETE FROM data_processing_log
WHERE timestamp < NOW() - INTERVAL '180 days';
EOF
```

### 12.3 Backup Personal Data

Ensure regular backups of user data:
```bash
# Backup PostgreSQL database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## Step 13: User Communication

### 13.1 Privacy Policy

Update to mention:
- "We comply with GDPR and other privacy regulations"
- "Users can export their data at /profile/privacy"
- "Users can delete their account at /profile/privacy"

### 13.2 Privacy Page Link

Add to footer or header:
```html
<a href="/profile/privacy">Privacy & Data Settings</a>
```

### 13.3 Email Notifications

When users delete account:
```
Subject: Account Deletion Confirmation

Your PawsCities account has been deleted. Your personal data has been
anonymized. Reviews are retained in anonymized form per our policy.

Contact support@pawscities.com for complete data erasure.

GDPR Article 17 - Right to Erasure
```

## Troubleshooting

### Issue: Webhook Not Triggering

**Solution:**
1. Verify webhook URL is accessible
2. Check `SUPABASE_WEBHOOK_SECRET` matches Supabase configuration
3. Look at Supabase logs: Project → Logs → Database → Webhooks
4. Test endpoint manually:
```bash
curl -X POST http://localhost:3000/api/webhooks/supabase-auth \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: test" \
  -d '{}'
```

### Issue: Rate Limiting Too Strict

**Solution:**
Adjust limits in `src/lib/security-config.ts`:
```typescript
// Increase limits for development
rateLimiting: {
  login: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 50, // Increase from 5
  },
}
```

### Issue: DataProcessingLog Not Created

**Solution:**
```bash
# Check migration was applied
npx prisma migrate status

# If not, run it:
npx prisma migrate deploy

# Verify table exists:
npx prisma studio
```

### Issue: Missing Dependencies

**Solution:**
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma client
npx prisma generate
```

## Summary

You have successfully implemented:

✅ GDPR compliance module with export/delete functions
✅ Security configuration (rate limiting, CSP, CORS)
✅ Auth webhook for user synchronization
✅ Consent management API
✅ GDPR endpoints (export, delete, consent, audit trail)
✅ Enhanced Auth Provider with login tracking
✅ Privacy settings page for users
✅ GDPR-compliant cookie banner
✅ Audit trail for data processing events
✅ Security headers and protections

## Next Steps

1. Review and update your Privacy Policy
2. Test all GDPR endpoints in staging
3. Add links to Privacy Settings page
4. Monitor audit logs for any issues
5. Set up automated log cleanup (monthly)
6. Train support team on GDPR requests

## Support

For questions or issues:
- Check `docs/GDPR_AND_SECURITY.md` for detailed documentation
- Review security logs at `/api/gdpr/audit-trail`
- Contact: support@pawscities.com

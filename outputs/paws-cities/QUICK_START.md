# Quick Start: GDPR & Security Implementation

A fast reference guide for deploying the GDPR and security enhancements.

## 5-Minute Setup

### 1. Add Environment Variables

```env
# .env.local
SUPABASE_WEBHOOK_SECRET=your_secret_from_supabase
GDPR_DATA_RETENTION_DAYS=90
GDPR_LOGS_RETENTION_DAYS=180
```

### 2. Run Database Migration

```bash
npx prisma migrate dev --name add_data_processing_log
```

### 3. Configure Supabase Webhook

In Supabase Dashboard:
1. Project → Webhooks
2. New webhook
3. URL: `https://pawscities.com/api/webhooks/supabase-auth`
4. Copy signing secret → `SUPABASE_WEBHOOK_SECRET`

### 4. Restart Development Server

```bash
npm run dev
```

### 5. Test

```bash
# Get your auth token first (login or use Supabase token)

# Test privacy page
curl http://localhost:3000/profile/privacy

# Test consent API
curl http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Done! ✅

## What Was Added

| File | Purpose |
|------|---------|
| `src/lib/gdpr.ts` | GDPR functions (export, delete, consent) |
| `src/lib/security.ts` | Security utilities (rate limiting, CSRF, validation) |
| `src/lib/security-config.ts` | Security configuration |
| `src/app/api/webhooks/supabase-auth/route.ts` | Auth sync webhook |
| `src/app/api/gdpr/*` | GDPR endpoints (export, delete, consent, audit-trail) |
| `src/app/api/auth/login-event/route.ts` | Login tracking |
| `src/app/profile/privacy/page.tsx` | Privacy settings page |
| `src/components/auth/AuthProvider.tsx` | Enhanced with login logging |
| `src/components/layout/CookieConsent.tsx` | GDPR-compliant cookie banner |
| `prisma/schema.prisma` | DataProcessingLog table |

## Key Endpoints

```
GET  /api/gdpr/export              # Download user data
GET  /api/gdpr/delete              # Check deletion status
POST /api/gdpr/delete              # Delete account
GET  /api/gdpr/consent             # Get consent
POST /api/gdpr/consent             # Update consent
GET  /api/gdpr/audit-trail         # View audit trail
POST /api/auth/login-event         # Track login
POST /api/webhooks/supabase-auth   # Supabase webhook
```

## User-Facing Features

- **Privacy Page**: `/profile/privacy`
  - View consent preferences
  - Download data
  - Delete account
  - View audit trail

- **Cookie Banner**: Automatically shown
  - Granular consent (necessary, analytics, marketing)
  - Saves to localStorage + database

## Testing GDPR Requests

```bash
# Export data
curl -X GET http://localhost:3000/api/gdpr/export \
  -H "Authorization: Bearer $TOKEN"

# Get consent
curl -X GET http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer $TOKEN"

# Update consent
curl -X POST http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"analytics":true,"marketing":false}'

# Delete account (requires confirmation)
curl -X POST http://localhost:3000/api/gdpr/delete \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"confirmation":"DELETE_MY_ACCOUNT"}'

# Get audit trail
curl -X GET "http://localhost:3000/api/gdpr/audit-trail?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

## Rate Limits

- **GDPR endpoints**: 1 request per 24 hours
- **Auth endpoints**: 5 attempts per 15 minutes
- **General API**: 100 requests per 15 minutes
- **Signup**: 3 new accounts per hour

## Features

✅ GDPR Article 15, 17, 20, 12 compliance
✅ User data export (JSON download)
✅ Account deletion with confirmation
✅ Consent management (analytics, marketing)
✅ Audit trail of all data processing
✅ Rate limiting per endpoint
✅ CSRF protection
✅ Input validation & sanitization
✅ Webhook signature verification
✅ Security headers
✅ Privacy settings page
✅ GDPR-compliant cookie banner

## Troubleshooting

**Webhook not working?**
- Verify `SUPABASE_WEBHOOK_SECRET` is set
- Check Supabase webhook URL is correct
- Look at server logs for errors

**Database errors?**
- Run `npx prisma migrate deploy`
- Verify PostgreSQL connection
- Check `DIRECT_URL` is set

**Rate limiting too strict?**
- Edit `src/lib/security-config.ts`
- Increase `maxRequests` values for development

**Cookie banner not showing?**
- Clear localStorage (`localStorage.clear()`)
- Reload page after 1 second

## Documentation

- **Full Guide**: `docs/GDPR_AND_SECURITY.md`
- **Setup Instructions**: `SECURITY_SETUP.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`

## Common Tasks

### Add Privacy Link to Header

```typescript
<Link href="/profile/privacy" className="...">
  Privacy & Data Settings
</Link>
```

### Check User Audit Trail

```typescript
const response = await fetch('/api/gdpr/audit-trail?days=30', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { auditTrail } = await response.json();
```

### Require Consent Before Feature

```typescript
const [consents, setConsents] = useState(null);

useEffect(() => {
  fetch('/api/gdpr/consent')
    .then(r => r.json())
    .then(data => setConsents(data.consents));
}, []);

if (consents?.find(c => c.type === 'analytics')?.consented) {
  // Enable feature
}
```

### Log Custom Data Processing Event

```typescript
import { logDataProcessing } from '@/lib/gdpr';

await logDataProcessing(userId, 'login', {
  provider: 'google',
  ip: userIP,
  timestamp: new Date().toISOString()
});
```

## Deployment Checklist

- [ ] Set environment variables
- [ ] Run database migration
- [ ] Configure Supabase webhook
- [ ] Test GDPR endpoints
- [ ] Test rate limiting
- [ ] Update privacy policy
- [ ] Add privacy link to navigation
- [ ] Test on production database
- [ ] Monitor audit logs

## Support

Questions? See:
- **API Documentation**: `docs/GDPR_AND_SECURITY.md`
- **Setup Guide**: `SECURITY_SETUP.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`

---

**Status**: ✅ Production Ready
**Last Updated**: 2024
**Compliance**: GDPR Articles 15, 17, 20, 12

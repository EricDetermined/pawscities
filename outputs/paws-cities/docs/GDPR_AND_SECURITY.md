# GDPR and Security Enhancements

This document outlines the GDPR compliance and security enhancements implemented in the PawsCities platform.

## Overview

The following components have been implemented to ensure GDPR compliance, user privacy, and application security:

1. **GDPR Compliance Module** (`src/lib/gdpr.ts`)
2. **Security Configuration** (`src/lib/security-config.ts`)
3. **Security Utilities** (`src/lib/security.ts`)
4. **Supabase Auth Webhook** (`src/app/api/webhooks/supabase-auth/route.ts`)
5. **GDPR API Endpoints**
6. **Enhanced Auth Provider**
7. **GDPR-Compliant Cookie Consent**
8. **Privacy Settings Page**

## GDPR Compliance

### Article 20 - Right to Data Portability

**Endpoint:** `GET /api/gdpr/export`

Users can request and download all their personal data in JSON format:
- User profile information
- Dog profiles
- Reviews and ratings
- Favorites and check-ins
- Activity history
- Consent records
- Data processing summary

```bash
curl -X GET https://pawscities.com/api/gdpr/export \
  -H "Authorization: Bearer <token>"
```

**Response:** JSON file with complete user data export

### Article 17 - Right to Erasure (Right to be Forgotten)

**Endpoint:** `POST /api/gdpr/delete`

Users can request permanent account deletion with confirmation:

```bash
curl -X POST https://pawscities.com/api/gdpr/delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"confirmation": "DELETE_MY_ACCOUNT"}'
```

**Process:**
1. User data is anonymized (email masked, name removed, avatar cleared)
2. Reviews are retained in anonymized form (preserves community value)
3. Personal data is deleted (dogs, favorites, check-ins, etc.)
4. Audit logs are maintained for compliance

### Consent Management

**Endpoint:** `POST /api/gdpr/consent`

Users can manage consent for different cookie/tracking types:

```bash
curl -X POST https://pawscities.com/api/gdpr/consent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "analytics": true,
    "marketing": false
  }'
```

**Consent Types:**
- **Necessary** (always enabled): Cookies required for site functionality
- **Analytics** (opt-in): Usage data for improvement
- **Marketing** (opt-in): Personalization and advertising

**Retrieve Consents:**
```bash
curl -X GET https://pawscities.com/api/gdpr/consent \
  -H "Authorization: Bearer <token>"
```

### Audit Trail

**Endpoint:** `GET /api/gdpr/audit-trail?days=90`

Users can view their complete data processing audit trail:

```bash
curl -X GET "https://pawscities.com/api/gdpr/audit-trail?days=30" \
  -H "Authorization: Bearer <token>"
```

**Logged Events:**
- User creation/deletion
- Login attempts
- Data exports
- Consent changes
- Data access

## Security Features

### Rate Limiting

Implemented in-memory rate limiting with configurable limits per endpoint:

```typescript
// Configuration in src/lib/security-config.ts
rateLimiting: {
  api: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  signup: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  gdpr: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 },
}
```

**Usage:**
```typescript
import { checkRateLimitMiddleware } from '@/lib/security';

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimitMiddleware(request, 'login');
  if (rateLimitResponse) {
    return rateLimitResponse; // 429 Too Many Requests
  }
  // ... proceed with request
}
```

### CSRF Protection

CSRF token generation and validation:

```typescript
import { csrfManager } from '@/lib/security';

// Generate token
const token = csrfManager.generate(sessionId);

// Validate token
const isValid = csrfManager.validate(sessionId, token);
```

### Input Validation & Sanitization

```typescript
import {
  validatePassword,
  sanitizeInput,
  validateEmail,
  validateURL
} from '@/lib/security';

// Validate password strength
const { valid, errors } = validatePassword(userPassword);

// Sanitize user input
const cleanInput = sanitizeInput(userInput, maxLength);

// Validate email format
if (!validateEmail(email)) {
  // Invalid email
}
```

### Webhook Signature Verification

Supabase webhooks are verified using HMAC-SHA256:

```typescript
import { verifyWebhookSignature } from '@/lib/security';

const isValid = verifyWebhookSignature(payload, signature, secret);
```

### Security Headers

Standard security headers are configured:

```typescript
import { getSecurityHeaders } from '@/lib/security';

// Apply headers to response
Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
  response.headers.set(key, value);
});
```

**Included Headers:**
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
- `Permissions-Policy`

### Content Security Policy (CSP)

CSP directives are defined and can be applied to responses:

```typescript
import { generateCSPHeader } from '@/lib/security-config';

const cspHeader = generateCSPHeader();
response.headers.set('Content-Security-Policy', cspHeader);
```

## Authentication Enhancements

### Enhanced Auth Provider

The `AuthProvider` now tracks login events:

```typescript
// src/components/auth/AuthProvider.tsx
import { useAuth } from '@/components/auth/AuthProvider';

const { user, session, signIn, signUp, signOut } = useAuth();
```

**Features:**
- Automatic login event logging to backend
- Provider tracking (email, google, etc.)
- First-login detection
- Graceful error handling for logging failures

### Supabase Auth Webhook

Automatically synchronizes Supabase auth events with the database:

- `user.created`: Creates User record in database
- `user.updated`: Synchronizes profile changes
- `user.deleted`: Anonymizes user data

**Setup:**
1. In Supabase console, create webhook pointing to:
   `https://pawscities.com/api/webhooks/supabase-auth`
2. Set `SUPABASE_WEBHOOK_SECRET` environment variable
3. Webhook signature verification is automatic

## Cookie & Consent Management

### GDPR-Compliant Cookie Banner

Located at: `src/components/layout/CookieConsent.tsx`

**Features:**
- Granular consent options (necessary, analytics, marketing)
- Opt-in approach (not opt-out)
- Persistent consent storage (localStorage + database)
- Easy preference management

**Consent Types:**
- **Necessary**: Always enabled (non-negotiable)
- **Analytics**: User behavior tracking for improvement
- **Marketing**: Personalization and advertising

### Privacy Settings Page

Located at: `src/app/profile/privacy/page.tsx`

Users can:
- View and update consent preferences
- Download personal data
- View data processing audit trail
- Request account deletion

## Data Processing & Audit Trail

### GDPR Module Functions

```typescript
import {
  exportUserData,
  deleteUserData,
  getConsentRecords,
  updateConsent,
  logDataProcessing,
  getAuditTrail,
  isDataRetentionExpired,
  anonymizeLogData,
} from '@/lib/gdpr';

// Export all user data
const exportData = await exportUserData(userId);

// Delete user data with anonymization
await deleteUserData(userId, { anonymize: true });

// Log data processing event
await logDataProcessing(userId, 'login', details, ipAddress, userAgent);

// Retrieve audit trail
const trail = await getAuditTrail(userId, 90); // Last 90 days
```

### Data Retention Policy

- **Active User Data**: Kept until deletion requested
- **Anonymized Reviews**: Retained indefinitely (community value)
- **Audit Logs**: Retained for 180 days
- **Deleted User Data**: Permanently removed after grace period

## Environment Variables

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx
SUPABASE_WEBHOOK_SECRET=xxxxxx

# App
NEXT_PUBLIC_APP_URL=https://pawscities.com
NODE_ENV=production
```

## Database Migrations

Apply the following migration to add the `DataProcessingLog` table:

```bash
npx prisma migrate dev --name add_data_processing_log
```

This creates the `data_processing_log` table with:
- `id`: Unique identifier
- `userId`: Reference to user
- `eventType`: Type of processing event
- `ipAddress`: Client IP (anonymized)
- `userAgent`: Client user agent (masked)
- `details`: Event metadata (JSON)
- `timestamp`: When event occurred
- Indexes for efficient querying

## Implementation Checklist

- [x] GDPR Module with export/delete functions
- [x] Security configuration and utilities
- [x] Rate limiting per endpoint
- [x] CSRF token management
- [x] Input validation and sanitization
- [x] Webhook signature verification
- [x] Enhanced Auth Provider with login tracking
- [x] Supabase Auth webhook handler
- [x] Consent management API
- [x] Data export API (Article 20)
- [x] Data deletion API (Article 17)
- [x] Audit trail API
- [x] GDPR-compliant cookie banner
- [x] Privacy settings page
- [x] Database schema updates
- [x] Comprehensive documentation

## Testing GDPR Endpoints

```bash
# Test export (returns JSON file)
curl -X GET http://localhost:3000/api/gdpr/export \
  -H "Authorization: Bearer <supabase_token>"

# Test consent retrieval
curl -X GET http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer <supabase_token>"

# Test consent update
curl -X POST http://localhost:3000/api/gdpr/consent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase_token>" \
  -d '{"analytics": true, "marketing": false}'

# Test audit trail
curl -X GET "http://localhost:3000/api/gdpr/audit-trail?days=30" \
  -H "Authorization: Bearer <supabase_token>"

# Test deletion request
curl -X POST http://localhost:3000/api/gdpr/delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase_token>" \
  -d '{"confirmation": "DELETE_MY_ACCOUNT"}'
```

## Best Practices

1. **Always verify authentication** before accessing user data
2. **Rate limit GDPR endpoints** (deletion allowed 1x per 24 hours)
3. **Log all data processing events** for audit trail
4. **Anonymize sensitive data** in logs (IPs, user agents)
5. **Encrypt sensitive data** in transit and at rest
6. **Use HTTPS only** in production
7. **Implement email verification** for account changes
8. **Provide clear privacy documentation** to users
9. **Respond to GDPR requests** within 30 days
10. **Update privacy notices** when policies change

## Support & Compliance

For GDPR-related requests from users:
- Data access requests: Use `/api/gdpr/export`
- Data deletion requests: Use `/api/gdpr/delete`
- Consent management: Use `/api/gdpr/consent`
- Support contact: support@pawscities.com

## References

- [GDPR Official Text](https://gdpr-info.eu/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OWASP Security Guidelines](https://owasp.org/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)

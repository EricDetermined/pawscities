# PawCities.com - DNS Configuration and Live Deployment Guide

**Last Updated:** February 2025
**Application:** PawCities (Next.js)
**Hosting:** Vercel
**Domain:** pawcities.com

---

## Table of Contents

1. [Domain DNS Configuration](#1-domain-dns-configuration)
2. [Vercel Domain Configuration](#2-vercel-domain-configuration)
3. [Supabase Configuration for Production](#3-supabase-configuration-for-production)
4. [Environment Variables for Production](#4-environment-variables-for-production)
5. [Pre-Launch Security Checklist](#5-pre-launch-security-checklist)
6. [Go-Live Checklist](#6-go-live-checklist)
7. [Post-Launch Monitoring](#7-post-launch-monitoring)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Domain DNS Configuration

### Overview

PawCities.com uses a multi-service DNS configuration to support:
- Web hosting via Vercel
- Email via Google Workspace
- DKIM/DMARC email authentication

### DNS Records Setup

All DNS records should be configured in your domain registrar (GoDaddy, Namecheap, Route 53, etc.).

#### A Records (Website Hosting)

| Name | Type | Value | TTL |
|------|------|-------|-----|
| @ | A | 76.76.21.21 | 3600 |

**Purpose:** Routes root domain requests to Vercel infrastructure
**Note:** Vercel may provide alternative IPs depending on your deployment region. Verify with Vercel dashboard before setting.

#### CNAME Records (WWW Subdomain)

| Name | Type | Value | TTL |
|------|------|-------|-----|
| www | CNAME | cname.vercel-dns.com | 3600 |

**Purpose:** Routes www.pawcities.com to Vercel
**Important:** After adding this record, you'll configure the redirect in Vercel to send www traffic to the root domain (@).

#### MX Records (Google Workspace Email)

| Name | Priority | Value | TTL |
|------|----------|-------|-----|
| @ | 1 | ASPMX.L.GOOGLE.COM | 3600 |
| @ | 5 | ALT1.ASPMX.L.GOOGLE.COM | 3600 |
| @ | 5 | ALT2.ASPMX.L.GOOGLE.COM | 3600 |
| @ | 10 | ALT3.ASPMX.L.GOOGLE.COM | 3600 |
| @ | 10 | ALT4.ASPMX.L.GOOGLE.COM | 3600 |

**Purpose:** Routes email traffic to Google Workspace servers
**Setup Order:** Add these in order of priority. Lower numbers are tried first.

#### SPF TXT Record

| Name | Type | Value | TTL |
|------|------|-------|-----|
| @ | TXT | v=spf1 include:_spf.google.com include:vercel.com ~all | 3600 |

**Purpose:** Authenticates emails from both Google Workspace and Vercel
**Components:**
- `v=spf1` - SPF version 1
- `include:_spf.google.com` - Allows Google Workspace to send emails
- `include:vercel.com` - Allows Vercel systems to send emails (webhooks, etc.)
- `~all` - Soft fail for other sources (can still be delivered, but marked as suspect)

#### Google Site Verification TXT Record

| Name | Type | Value | TTL |
|------|------|-------|-----|
| @ | TXT | google-site-verification=YOUR_VERIFICATION_CODE | 3600 |

**Purpose:** Verifies domain ownership in Google Search Console
**To Generate:**
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property for pawcities.com
3. Select "TXT record" verification method
4. Copy the verification code provided
5. Replace `YOUR_VERIFICATION_CODE` with the actual code

#### DMARC Policy TXT Record

| Name | Type | Value | TTL |
|------|------|-------|-----|
| _dmarc | TXT | v=DMARC1; p=quarantine; rua=mailto:dmarc@pawcities.com; pct=100 | 3600 |

**Purpose:** Sets email authentication policy
**Parameters:**
- `v=DMARC1` - DMARC version 1
- `p=quarantine` - Quarantine emails that fail authentication (change to `p=none` for testing)
- `rua=mailto:dmarc@pawcities.com` - Send aggregate reports to dmarc mailbox
- `pct=100` - Apply policy to 100% of messages

**Important:** After Google Workspace is set up, update to use their reporting email.

#### DKIM CNAME Record

| Name | Type | Value | TTL |
|------|------|-------|-----|
| google._domainkey | CNAME | google.dkim.verifydomainownership.com | 3600 |

**Purpose:** Enables DKIM (DomainKeys Identified Mail) signing
**To Generate:**
1. Go to Google Admin Console (admin.google.com)
2. Navigate to Security > Authentication > Authenticate email
3. Select pawcities.com domain
4. Generate DKIM key
5. Copy the CNAME record value provided
6. Add to your DNS provider

**Note:** The value may vary. Use the exact value from Google Admin Console.

---

### DNS Propagation Verification

After adding all records, verify propagation using these tools:

```bash
# Check A record
nslookup pawcities.com

# Check MX records
nslookup -type=MX pawcities.com

# Check TXT records (SPF, DMARC)
nslookup -type=TXT pawcities.com

# Check CNAME records
nslookup www.pawcities.com

# Using dig (more detailed)
dig pawcities.com
dig MX pawcities.com
dig TXT pawcities.com
```

**Expected Propagation Time:** 24-48 hours (though often faster)

**Online Tools:**
- [MXToolbox](https://mxtoolbox.com/) - Complete DNS verification
- [Google Admin Toolbox](https://toolbox.googleapps.com/apps/) - Email configuration check
- [DNS Checker](https://dnschecker.org/) - Global propagation check

---

## 2. Vercel Domain Configuration

### 2.1 Add Custom Domain in Vercel

**Prerequisites:**
- Vercel project for PawCities created and deployed
- DNS records for pawcities.com configured at your registrar
- Domain registrar allows external DNS management

**Steps:**

1. **Go to Vercel Dashboard**
   - Log in to [Vercel.com](https://vercel.com)
   - Select the PawCities project

2. **Navigate to Domains Settings**
   - Click "Settings" → "Domains"
   - Click "Add Domain"

3. **Enter Domain Name**
   - Type: `pawcities.com`
   - Click "Add"

4. **Configure DNS Records**
   - Vercel will show you the required DNS records
   - A Record: `76.76.21.21` (may vary)
   - CNAME Record for www: `cname.vercel-dns.com`

5. **Verify Configuration**
   - Add the records at your DNS provider
   - Vercel will automatically verify when records propagate
   - Status will change to "Valid Configuration"

### 2.2 Configure WWW Subdomain Redirect

**Option A: Redirect www to non-www (Recommended)**

1. In Vercel Domains settings, add `www.pawcities.com`
2. After verification, set redirect:
   - Click the three-dot menu next to www.pawcities.com
   - Select "Redirect to pawcities.com"
   - Choose "Permanent redirect (301)"

**Option B: Serve both domains**

If your application needs to serve both, ensure your `next.config.js` includes:

```javascript
async redirects() {
  return [
    {
      source: '/:path*',
      destination: 'https://pawcities.com/:path*',
      basePath: false,
      permanent: true,
      has: [
        {
          type: 'host',
          value: 'www.pawcities.com',
        },
      ],
    },
  ]
}
```

### 2.3 SSL/TLS Configuration

**Status:** Automatic

Vercel automatically provisions and renews SSL/TLS certificates via Let's Encrypt.

**Verification:**
- Visit https://pawcities.com
- Check the SSL certificate (browser lock icon)
- Should show valid certificate issued by Let's Encrypt

**Configuration in Vercel:**
1. Settings → Domains → Security
2. SSL/TLS should show "Active"
3. Auto-renewal is enabled by default

### 2.4 Environment Variables in Vercel

**Access Production Environment Variables:**

1. Go to Project Settings → Environment Variables
2. Ensure all production variables are set
3. Variables marked "Production" apply only to production deployments

**Critical Variables to Set:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SITE_URL=https://pawcities.com
SUPABASE_WEBHOOK_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ANTHROPIC_API_KEY
OPENWEATHER_API_KEY
```

**Best Practices:**
- Never store secrets in code or git
- Use Vercel's built-in variable encryption
- Rotate secrets quarterly
- Document which services require which variables

---

## 3. Supabase Configuration for Production

### 3.1 Allowed Redirect URLs

Update Supabase to accept redirects from pawcities.com only.

**Steps:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to "Settings" → "Authentication" → "URL Configuration"

**Update these URLs:**

```
Site URL: https://pawcities.com
Redirect URLs:
  - https://pawcities.com/**
  - https://www.pawcities.com/** (if serving both)
  - http://localhost:3000/** (for local development)
```

**Important:**
- Remove any staging URLs from production settings
- Use only HTTPS for production
- The `/**` wildcard captures all redirect paths

### 3.2 OAuth Provider Configuration

Update OAuth callbacks for Google, GitHub, and other providers.

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your PawCities project
3. Navigate to "APIs & Services" → "Credentials"
4. Click on your OAuth 2.0 Client ID
5. Under "Authorized redirect URIs", add:
   ```
   https://pawcities.supabase.co/auth/v1/callback
   https://pawcities.com/api/auth/callback/google
   ```
6. Save changes

**GitHub OAuth (if applicable):**
1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Edit your OAuth App
3. Update "Authorization callback URL":
   ```
   https://pawcities.supabase.co/auth/v1/callback
   https://pawcities.com/api/auth/callback/github
   ```
4. Save changes

### 3.3 SMTP Configuration for Emails

Configure Google Workspace as custom SMTP provider.

**Steps:**

1. In Supabase, go to "Settings" → "Authentication" → "Email"
2. Select "Custom SMTP"
3. Enter these details:

```
Host: smtp.google.com
Port: 465
Username: noreply@pawcities.com
Password: [App-specific password from Google Workspace]
From Email: noreply@pawcities.com
From Name: PawCities
```

**To Generate Google App Password:**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification (if not already enabled)
3. Go to "App passwords"
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password
6. Use this as the SMTP password in Supabase

**Email Templates:**
After SMTP is configured, update email templates in Supabase:
- Confirmation Email
- Magic Link Email
- Password Reset Email
- Change Email Address Email

All templates should:
- Use PawCities branding and colors
- Include company logo
- Link back to https://pawcities.com
- Have clear call-to-action buttons

### 3.4 Database Connection Pooling

Ensure optimal performance with connection pooling.

**In Supabase Settings:**
1. Go to "Database" → "Connection Pooling"
2. Set Pool Mode to "Transaction"
3. Max Pool Size: 15 (adjust based on load)
4. Connection Timeout: 300 seconds

**Update Environment Variables:**
```
DATABASE_URL=postgres://user:pass@db.supabase.co:6543/postgres?schema=public
DIRECT_URL=postgres://user:pass@db.supabase.co:5432/postgres?schema=public
```

Use `DIRECT_URL` for migrations, `DATABASE_URL` for application queries with pooling.

---

## 4. Environment Variables for Production

### Complete Environment Variable Reference

All environment variables must be set in Vercel before deployment.

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| **NEXT_PUBLIC_SUPABASE_URL** | Public | Supabase project URL | https://xxxxx.supabase.co |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Public | Supabase public API key | eyJhbGciOiJIUzI1NiIs... |
| **SUPABASE_SERVICE_ROLE_KEY** | Secret | Supabase service role (admin) | eyJhbGciOiJIUzI1NiIs... |
| **DATABASE_URL** | Secret | Connection string with pooling | postgres://user:pass@... |
| **DIRECT_URL** | Secret | Direct DB connection | postgres://user:pass@... |
| **NEXT_PUBLIC_SITE_URL** | Public | Production site URL | https://pawcities.com |
| **SUPABASE_WEBHOOK_SECRET** | Secret | Webhook signature secret | random_secret_key |
| **GOOGLE_CLIENT_ID** | Secret | Google OAuth client ID | xxxx.apps.googleusercontent.com |
| **GOOGLE_CLIENT_SECRET** | Secret | Google OAuth secret | GOCSPX-xxxx |
| **ANTHROPIC_API_KEY** | Secret | Claude API key | sk-ant-xxxx |
| **OPENWEATHER_API_KEY** | Secret | OpenWeather API key | xxxx |

### Setting Variables in Vercel

**Steps:**

1. Go to Project Settings → Environment Variables
2. For each variable:
   - Enter variable name
   - Enter value
   - Select environments: Production
   - Click "Save"

3. Mark secrets appropriately:
   - Vercel encrypts secret variables
   - Secrets are never shown in logs
   - Secrets cannot be read after creation

**Verification:**
```bash
# After deployment, verify variables are accessible
# (without exposing values)
npm run build
npm run start

# Check for "undefined" variables in logs
```

### Local Development Variables

Create `.env.local` for local development (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_connection_string
DIRECT_URL=your_direct_connection
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_WEBHOOK_SECRET=dev_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
ANTHROPIC_API_KEY=your_anthropic_key
OPENWEATHER_API_KEY=your_weather_key
```

---

## 5. Pre-Launch Security Checklist

Complete all items before going live.

### 5.1 SSL/TLS Security

- [ ] HTTPS redirect active for all traffic
- [ ] SSL certificate valid (check in browser)
- [ ] HSTS header set (see Security Headers section)
- [ ] Mixed content warnings resolved
- [ ] Certificate auto-renewal enabled in Vercel

**Verification:**
```bash
# Check SSL certificate
curl -I https://pawcities.com

# Check HSTS header
curl -I https://pawcities.com | grep -i "strict-transport"

# Test with SSL Labs
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=pawcities.com
```

### 5.2 Security Headers Configuration

Verify `vercel.json` includes these headers:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        }
      ]
    }
  ]
}
```

- [ ] Strict-Transport-Security header set
- [ ] X-Content-Type-Options: nosniff configured
- [ ] X-Frame-Options: SAMEORIGIN configured
- [ ] X-XSS-Protection enabled
- [ ] Referrer-Policy configured
- [ ] Content-Security-Policy considered

**Test Headers:**
```bash
curl -I https://pawcities.com | grep -i "strict-transport\|content-type\|frame-options"
```

### 5.3 CORS Configuration

Verify CORS is properly configured for required domains.

**In Next.js API routes (if needed):**
```javascript
// api/example.js
export default function handler(req, res) {
  const allowedOrigins = [
    'https://pawcities.com',
    'https://www.pawcities.com'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle request
}
```

- [ ] CORS headers set for authorized origins only
- [ ] Credentials properly handled
- [ ] OPTIONS requests supported
- [ ] Preflight requests pass

### 5.4 Rate Limiting

Implement rate limiting on API routes to prevent abuse.

**Using Vercel's built-in rate limiting:**

Add to `vercel.json`:
```json
{
  "functions": {
    "api/**": {
      "memory": 256,
      "maxDuration": 30
    }
  }
}
```

**Application-level rate limiting (recommended):**

```javascript
// lib/rateLimit.js
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function handler(req, res) {
  const identifier = req.headers['x-forwarded-for'];
  const { success } = await ratelimit.limit(identifier);

  if (!success) {
    return res.status(429).json({ error: "Too many requests" });
  }

  // Handle request
}
```

- [ ] Rate limiting configured on sensitive endpoints
- [ ] Limits appropriate for expected traffic
- [ ] Rate limit headers returned to client
- [ ] Graceful 429 responses implemented

### 5.5 Environment Variable Audit

Ensure no secrets are exposed in code or logs.

**Checklist:**
- [ ] No API keys in `.env.local` or `.env` files tracked in git
- [ ] `.env.local` added to `.gitignore`
- [ ] All secrets stored in Vercel Environment Variables
- [ ] No secrets in error messages or logs
- [ ] API keys not exposed in browser console
- [ ] Database passwords not in connection strings visible to client
- [ ] All `NEXT_PUBLIC_*` variables are non-sensitive

**Verification:**
```bash
# Check for secrets in git history
git log -p --all -S "ASPMX\|ANTHROPIC\|CLIENT_SECRET" | head -50

# Check for exposed keys in code
grep -r "sk-ant-" .
grep -r "GOCSPX-" .
grep -r "password=" .

# Verify .gitignore
cat .gitignore | grep -i "env"
```

### 5.6 Supabase Row Level Security (RLS)

All tables must have RLS policies enforced.

**Verification Checklist:**

1. **Enable RLS on all tables:**
   ```sql
   -- In Supabase SQL Editor
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public';

   -- For each table, verify RLS is enabled
   SELECT * FROM pg_tables
   WHERE tablename = 'users'
   AND rowsecurity = true;
   ```

2. **Policies configured correctly:**
   - [ ] Users can only read their own data
   - [ ] Service role can read/write all data
   - [ ] Anonymous users have limited access
   - [ ] Admin users have appropriate access

3. **Test policies:**
   ```javascript
   // In your application
   const { data, error } = await supabase
     .from('users')
     .select('*')
     .eq('id', currentUser.id);

   // Should succeed (user's own data)
   // Should fail if trying to access other user's data
   ```

- [ ] RLS enabled on all tables
- [ ] Policies allow only authorized access
- [ ] Service role key kept secret
- [ ] Public access limited appropriately

### 5.7 API Route Authentication

Verify all sensitive API routes require authentication.

**Example protected route:**
```javascript
// api/protected-route.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get token from Authorization header
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify token
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Proceed with authenticated request
}
```

- [ ] Authentication required on protected endpoints
- [ ] Tokens validated server-side
- [ ] Public endpoints documented
- [ ] Authentication errors return 401/403

### 5.8 GDPR Compliance

Ensure compliance with GDPR and privacy regulations.

**Checklist:**
- [ ] Privacy policy published at /privacy
- [ ] Terms of service published at /terms
- [ ] Cookie consent banner implemented
- [ ] User data export functionality available
- [ ] User deletion functionality available
- [ ] Data processing agreements with third parties
- [ ] DPA in place with Vercel and Supabase
- [ ] DMARC reports reviewed and configured

**Required Pages:**
1. `/privacy` - Detailed privacy policy
2. `/terms` - Terms of service
3. Cookie policy (in privacy or separate)

**Third-party Compliance:**
- [ ] Vercel Data Processing Agreement signed
- [ ] Supabase Data Processing Agreement signed
- [ ] Google Workspace DPA in place
- [ ] Google Analytics (if used) compliant

---

## 6. Go-Live Checklist

Complete these steps in order to safely deploy to production.

### 6.1 Pre-Launch (48 hours before)

- [ ] All tests passing (`npm run test`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] No console errors or warnings
- [ ] All environment variables set in Vercel
- [ ] Database migrations complete
- [ ] Supabase RLS policies verified
- [ ] DNS records propagated (check with tools in Section 1)
- [ ] SSL certificate active
- [ ] Load testing completed (if applicable)

### 6.2 Immediate Pre-Launch (1 hour before)

- [ ] Staging environment fully tested
- [ ] Team notified of launch time
- [ ] Monitoring and alerting configured
- [ ] Support team on standby
- [ ] Rollback plan documented

**Notification Template:**
```
Subject: PawCities.com Going Live - Standby for Monitoring

Team,

We're launching PawCities.com to production at [TIME] [TIMEZONE].

Key Details:
- Domain: pawcities.com
- Hosting: Vercel
- Database: Supabase
- Expected downtime: None (DNS propagation may take time)

During launch:
- Monitor dashboard for errors
- Check analytics for traffic
- Be ready to assist users with initial issues
- Report any unusual activity

Contact [LEAD] for emergencies.
```

### 6.3 Launch Steps (Ordered)

**Step 1: Update DNS at Registrar (if not already done)**
```
A Record: @ → 76.76.21.21
CNAME Record: www → cname.vercel-dns.com
All MX, TXT, and DKIM records
```

**Step 2: Verify DNS Propagation**
```bash
# Wait for propagation (may take 24 hours globally)
nslookup pawcities.com
dig MX pawcities.com
```

**Step 3: Add Domain in Vercel (if not already done)**
- Go to Vercel Project Settings
- Add Custom Domain: pawcities.com
- Wait for verification

**Step 4: Deploy to Production**
```bash
# Trigger production deployment in Vercel
# Via GitHub push to main/production branch
# Or via "Deploy" button in Vercel dashboard
```

**Step 5: Verify Deployment**
```bash
# Check site is live
curl https://pawcities.com

# Check homepage loads
open https://pawcities.com

# Verify SSL certificate
curl -I https://pawcities.com | grep "SSL\|TLS"

# Test API endpoints
curl https://pawcities.com/api/health

# Test authentication flow
# Manually test signup/login
```

**Step 6: Test Email**
```bash
# Send test email from admin panel (or API)
# Verify email arrives
# Check email headers for SPF/DKIM/DMARC

# Verify no "Failed Authentication" warnings
```

**Step 7: Update DNS Propagation Monitoring**
- Use MXToolbox to monitor
- Check SPF/DKIM/DMARC status
- Verify all records are live globally

**Step 8: Monitor for Issues**
```bash
# Check Vercel analytics
# Monitor error rates
# Review API response times
# Check database query performance
# Monitor email delivery

# Set up alerts for:
- Error rate > 1%
- API response time > 3s
- Database connection errors
- Failed email deliveries
```

### 6.4 Post-Launch (Next 24 hours)

- [ ] Monitor error rates and performance
- [ ] Check email delivery logs
- [ ] Review user feedback
- [ ] Monitor database performance
- [ ] Check API rate limiting
- [ ] Verify all third-party integrations working
- [ ] Test on mobile devices
- [ ] Check SEO (robots.txt, sitemap.xml)
- [ ] Update status page if applicable

**Daily Monitoring Checklist:**
```
[ ] Check Vercel analytics dashboard
[ ] Review application error logs
[ ] Verify database performance
[ ] Check email delivery status
[ ] Monitor API endpoint latency
[ ] Review security audit logs
[ ] Check for failed RLS violations
[ ] Verify backup completion
```

---

## 7. Post-Launch Monitoring

### 7.1 Monitoring Tools Setup

**Vercel Analytics Dashboard**
- Real-time traffic and errors
- Performance metrics
- Deployment history
- Function execution times

**Supabase Monitoring**
- Query performance
- Database connections
- Storage usage
- Row-level security logs

**DNS and Email Monitoring**
- MXToolbox for email health
- DNS propagation status
- SPF/DKIM/DMARC compliance
- Delivery rate monitoring

### 7.2 Alerting Configuration

**Critical Alerts (Immediate Notification):**
- Error rate > 1% (error threshold for production)
- API response time > 5s (performance degradation)
- Database connection pool exhausted
- SSL certificate expiring soon
- Email delivery failures > 10%

**Warning Alerts (Daily Review):**
- Unusual traffic patterns
- Performance degradation
- Increased database query time
- Failed authentication attempts

**Setup Example (Using Vercel):**
1. Go to Project Settings → Integrations
2. Add monitoring service (e.g., DataDog, New Relic)
3. Configure alert thresholds
4. Set notification channels (Slack, email)

### 7.3 Performance Monitoring

**Key Metrics to Track:**

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Largest Contentful Paint (LCP) | < 2.5s | 2.5-4s | > 4s |
| First Input Delay (FID) | < 100ms | 100-300ms | > 300ms |
| Cumulative Layout Shift (CLS) | < 0.1 | 0.1-0.25 | > 0.25 |
| API Response Time | < 200ms | 200-500ms | > 500ms |
| Error Rate | < 0.1% | 0.1-1% | > 1% |
| Database Query Time | < 50ms | 50-200ms | > 200ms |

**Tools:**
- Google Lighthouse (https://developers.google.com/web/tools/lighthouse)
- Web Vitals (integrated in Next.js)
- Vercel Analytics
- Supabase Performance Insights

---

## 8. Troubleshooting

### 8.1 Domain Not Resolving

**Symptoms:**
- Site shows "DNS_PROBE_FINISHED_NXDOMAIN"
- Browser says "site can't be reached"

**Solutions:**

1. **Check DNS Records at Registrar**
   ```bash
   nslookup pawcities.com

   # Should return: 76.76.21.21
   ```

2. **Verify Vercel IP is Correct**
   - Log into Vercel dashboard
   - Go to Project → Domains
   - Check "A record" value matches

3. **Wait for Propagation**
   - DNS changes take up to 48 hours
   - Use MXToolbox to check status globally

4. **Clear Local DNS Cache**
   ```bash
   # macOS
   sudo dscacheutil -flushcache

   # Windows
   ipconfig /flushdns

   # Linux
   sudo systemctl restart systemd-resolved
   ```

### 8.2 SSL Certificate Issues

**Symptoms:**
- "Not Secure" warning in browser
- SSL handshake failed
- Certificate not valid

**Solutions:**

1. **Wait for Certificate Issuance**
   - Vercel automatically provisions certificates
   - May take 15-30 minutes after DNS verification

2. **Check Vercel Dashboard**
   - Go to Settings → Domains
   - Domain should show "Valid Configuration"
   - SSL certificate should show "Active"

3. **Force HTTPS Redirect**
   - Add to `vercel.json`:
   ```json
   {
     "redirects": [
       {
         "source": "/(?!.*\\..*|.*:.*)(.*)",
         "destination": "https://pawcities.com$1",
         "permanent": true
       }
     ]
   }
   ```

4. **Verify Certificate**
   ```bash
   openssl s_client -connect pawcities.com:443
   # Should show valid certificate from Let's Encrypt
   ```

### 8.3 Email Delivery Issues

**Symptoms:**
- Emails not arriving
- Marked as spam
- Authentication failures

**Solutions:**

1. **Check SPF Record**
   ```bash
   nslookup -type=TXT pawcities.com | grep spf
   # Should return: v=spf1 include:_spf.google.com include:vercel.com ~all
   ```

2. **Verify DKIM**
   ```bash
   nslookup -type=CNAME google._domainkey.pawcities.com
   # Should return: google.dkim.verifydomainownership.com
   ```

3. **Test with MXToolbox**
   - Go to https://mxtoolbox.com/
   - Search for pawcities.com
   - Check SPF, DKIM, DMARC status

4. **Check Supabase SMTP**
   - Test email send in Supabase dashboard
   - Verify SMTP credentials in production

5. **Check Google Workspace**
   - Verify domain is added in Google Admin
   - Check "Authenticate email" configuration
   - Verify DKIM is active

### 8.4 Database Connection Issues

**Symptoms:**
- Application can't connect to database
- Timeouts on API requests
- "Too many connections" errors

**Solutions:**

1. **Verify Connection Strings**
   ```bash
   # Check that DATABASE_URL and DIRECT_URL are set
   # In Vercel: Settings → Environment Variables
   # DATABASE_URL should use connection pooling
   # DIRECT_URL should use direct connection
   ```

2. **Check Connection Pool Status**
   - Go to Supabase Dashboard
   - Database → Connection Pooling
   - Verify pool size and timeout settings

3. **Review Connection Limits**
   ```sql
   -- In Supabase SQL Editor
   SELECT count(*) FROM pg_stat_activity;
   -- Should be < max_connections (typically 20 for Supabase Free)
   ```

4. **Check for Stale Connections**
   ```sql
   -- Terminate idle connections
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND state_change < now() - interval '5 minutes';
   ```

5. **Increase Connection Pool (if needed)**
   - Upgrade Supabase plan
   - Or reduce max connections per instance

### 8.5 Slow API Response Times

**Symptoms:**
- API endpoints taking > 1 second
- Homepage loading slowly
- Database queries timing out

**Solutions:**

1. **Identify Slow Queries**
   ```sql
   -- In Supabase SQL Editor
   SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. **Add Database Indexes**
   ```sql
   -- Create index on frequently queried columns
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_posts_user_id ON posts(user_id);
   ```

3. **Optimize API Route**
   ```javascript
   // Use caching to reduce database hits
   import { unstable_cache } from 'next/cache';

   export const getUsers = unstable_cache(
     async () => {
       return await db.users.findMany();
     },
     ['users'],
     { revalidate: 3600, tags: ['users'] }
   );
   ```

4. **Enable Query Caching**
   - Use Redis cache for frequently accessed data
   - Implement Next.js ISR (Incremental Static Regeneration)

5. **Check Vercel Function Duration**
   - Go to Vercel Dashboard → Analytics
   - Review function execution times
   - Optimize longest-running functions

### 8.6 Environment Variable Not Accessible

**Symptoms:**
- Variable shows as "undefined" in application
- API key not found
- Database connection fails

**Solutions:**

1. **Verify Variable is Set in Vercel**
   ```
   Settings → Environment Variables
   Check for:
   - Correct name (case-sensitive)
   - Value is set
   - Environment is set to "Production"
   ```

2. **Redeploy After Adding Variables**
   ```bash
   # Variables only apply to new deployments
   git push origin main
   # OR manually redeploy in Vercel
   ```

3. **Check Variable Scope**
   ```
   NEXT_PUBLIC_* variables: accessible in browser
   Other variables: server-only, hidden from browser
   ```

4. **Verify No Typos**
   ```
   Common mistakes:
   - NEXT_PUBLIC_SUPABASE_URL (not BASE_URL)
   - SUPABASE_SERVICE_ROLE_KEY (not API_KEY)
   - DATABASE_URL (not CONNECTION_STRING)
   ```

5. **Test Locally First**
   ```bash
   # Create .env.local and test locally
   npm run dev
   # Verify variables work before deploying
   ```

### 8.7 WWW Redirect Not Working

**Symptoms:**
- Both www.pawcities.com and pawcities.com accessible
- Redirect returns 404 or timeout

**Solutions:**

1. **Verify CNAME Record**
   ```bash
   nslookup www.pawcities.com
   # Should resolve to Vercel IP
   ```

2. **Check Vercel Domain Configuration**
   - Settings → Domains
   - www.pawcities.com should show "Redirect to pawcities.com"
   - Click three-dot menu and select redirect option

3. **Use vercel.json Redirect**
   ```json
   {
     "redirects": [
       {
         "source": "/(?!.*\\..*|.*:.*)(.*)",
         "destination": "https://pawcities.com$1",
         "has": [
           {
             "type": "host",
             "value": "www.pawcities.com"
           }
         ],
         "permanent": true
       }
     ]
   }
   ```

4. **Clear Browser Cache**
   - 301 redirects are cached
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### 8.8 High Database Costs

**Symptoms:**
- Supabase billing increasing rapidly
- Database storage growing unexpectedly
- Unusual query patterns

**Solutions:**

1. **Monitor Database Growth**
   ```sql
   -- Check table sizes
   SELECT schemaname, tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

2. **Enable Row-Level Security**
   - Reduces unnecessary data transfers
   - Supabase charges by data retrieved, not rows

3. **Implement Connection Pooling**
   - Reduces connection overhead
   - Already configured in Section 3.4

4. **Clean Up Old Data**
   ```sql
   -- Archive or delete old records
   DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';
   ```

5. **Review API Usage**
   - Check for inefficient queries
   - Implement caching
   - Use database views for complex queries

---

## Additional Resources

### Documentation
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Workspace Help](https://support.google.com/a)

### Tools
- [DNS Checker](https://dnschecker.org/)
- [MXToolbox](https://mxtoolbox.com/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)
- [Google Search Console](https://search.google.com/search-console)
- [Vercel Analytics](https://vercel.com/analytics)

### Monitoring Services
- [Vercel Integrations](https://vercel.com/integrations)
- [Sentry](https://sentry.io/) - Error tracking
- [Datadog](https://www.datadoghq.com/) - Monitoring and observability
- [LogRocket](https://logrocket.com/) - Session replay and debugging
- [Better Stack](https://betterstack.com/) - Uptime monitoring

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Mozilla Web Security](https://infosec.mozilla.org/guidelines/web_security)
- [Let's Encrypt](https://letsencrypt.org/) - Free SSL/TLS certificates

---

## Contact & Support

For issues or questions regarding this deployment guide:

**Project Lead:** [Your Name]
**Email:** [Your Email]
**Slack:** [Channel Name]

**Escalation Path:**
1. Check Troubleshooting section (Section 8)
2. Review monitoring dashboards
3. Contact Project Lead
4. Escalate to Senior Engineer if critical

---

**Document Version:** 1.0
**Last Updated:** February 2025
**Next Review:** May 2025

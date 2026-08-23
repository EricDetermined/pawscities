// GA4 Data API client (2026-08-23).
//
// Reads the service-account credentials from app_config (keys
// 'ga4_service_account' + 'ga4_property_id', stored during the GA4 unlock —
// same runtime-credential pattern as the Meta page token, so rotation never
// requires a redeploy). Auth is a plain RS256 JWT exchange implemented with
// node:crypto — no googleapis dependency.

import { createSign } from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface Ga4Credentials {
  client_email: string;
  private_key: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedConfig: { creds: Ga4Credentials; propertyId: string } | null = null;

async function getConfig(): Promise<{ creds: Ga4Credentials; propertyId: string } | null> {
  if (cachedConfig) return cachedConfig;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['ga4_service_account', 'ga4_property_id']);
  const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
  if (!map.ga4_service_account || !map.ga4_property_id) return null;
  try {
    cachedConfig = {
      creds: JSON.parse(map.ga4_service_account) as Ga4Credentials,
      propertyId: map.ga4_property_id,
    };
    return cachedConfig;
  } catch {
    return null;
  }
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken(creds: Ga4Credentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(creds.private_key, 'base64url');
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`GA4 token exchange failed: ${JSON.stringify(data).slice(0, 200)}`);
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

export interface Ga4ReportRow {
  dimensions: string[];
  metrics: number[];
}

export async function runGa4Report(opts: {
  metrics: string[];
  dimensions?: string[];
  startDate?: string; // e.g. '7daysAgo'
  endDate?: string;   // e.g. 'today'
  limit?: number;
}): Promise<Ga4ReportRow[] | null> {
  const config = await getConfig();
  if (!config) return null; // not configured — caller degrades gracefully
  const token = await getAccessToken(config.creds);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: opts.startDate ?? '7daysAgo', endDate: opts.endDate ?? 'today' }],
        metrics: opts.metrics.map(name => ({ name })),
        dimensions: (opts.dimensions ?? []).map(name => ({ name })),
        limit: opts.limit ?? 50,
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await res.json();
  if (data.error) throw new Error(`GA4 runReport error: ${data.error.message}`);
  return (data.rows ?? []).map((r: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => ({
    dimensions: (r.dimensionValues ?? []).map(d => d.value),
    metrics: (r.metricValues ?? []).map(m => Number(m.value)),
  }));
}

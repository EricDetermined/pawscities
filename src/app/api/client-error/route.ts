export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/client-error
 *
 * Lightweight client-side error sink (2026-09-20, per Eric — 6 months in, we
 * want real user-facing errors captured, not just discovered in weekly audits).
 * The browser reports uncaught errors, unhandled promise rejections, and React
 * error-boundary crashes here. Rows land in `client_errors` for the daily
 * health check to surface and alert on. No auth: it's a public write-only sink
 * (anyone's browser can hit it) — so we hard-cap size, rate-limit per IP in
 * memory, and never trust the payload as instructions.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Best-effort in-memory rate limit: 20 errors / IP / 10 min (survives within a
// warm serverless instance; a cold start resets it — acceptable for a sink).
const hits = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;

function limited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { n: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.n++;
  return rec.n > MAX_PER_WINDOW;
}

const clip = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (limited(ip)) return NextResponse.json({ ok: true, throttled: true });

    const body = await request.json().catch(() => ({}));
    const message = clip(body.message, 1000);
    if (!message) return NextResponse.json({ ok: false }, { status: 400 });

    // Ignore known-benign noise (browser extensions, cancelled fetches).
    const IGNORE = /ResizeObserver loop|Non-Error promise rejection captured|Load failed|cancelled|The operation was aborted|extension:\/\//i;
    if (IGNORE.test(message)) return NextResponse.json({ ok: true, ignored: true });

    await admin.from('client_errors').insert({
      message,
      source: clip(body.source, 60) || 'window',        // 'window' | 'promise' | 'boundary'
      url: clip(body.url, 500),
      stack: clip(body.stack, 4000),
      user_agent: clip(request.headers.get('user-agent'), 400),
      severity: body.source === 'boundary' ? 'critical' : 'error',
    });

    return NextResponse.json({ ok: true });
  } catch {
    // A failing error-sink must never itself throw noisily.
    return NextResponse.json({ ok: false });
  }
}

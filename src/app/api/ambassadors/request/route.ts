export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAmbassadorRequestAlert } from '@/lib/email';

/**
 * POST /api/ambassadors/request
 *
 * Public "front door" for the invite-only Ambassador program (2026-09-22, per
 * Eric). The /ambassadors page is an invite-CODE gate; this lets someone WITHOUT
 * a code raise their hand. Requests land in `ambassador_requests` (pending) for
 * admin review, and admins get an email alert. No auth — public write-only sink,
 * so we hard-cap size, rate-limit per IP, and validate before insert.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Best-effort in-memory rate limit: 5 requests / IP / 10 min.
const hits = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
function limited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) { hits.set(ip, { n: 1, resetAt: now + WINDOW_MS }); return false; }
  rec.n++;
  return rec.n > MAX_PER_WINDOW;
}

const clip = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : null;

function normHandle(v: unknown): string | null {
  const s = clip(v, 60);
  if (!s) return null;
  return s.toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/^@+/, '')
    .split(/[/?#]/)[0]
    .slice(0, 30) || null;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (limited(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const name = clip(body.name, 120);
    const email = clip(body.email, 200);
    const city = clip(body.city, 60);
    const instagram_handle = normHandle(body.instagramHandle ?? body.instagram_handle);
    const reason = clip(body.reason, 1000);

    if (!name || !email) {
      return NextResponse.json({ error: 'Please include your name and email.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const { error } = await admin.from('ambassador_requests').insert({
      name, email, city, instagram_handle, reason, status: 'pending', source: 'ambassadors-gate',
    });
    if (error) {
      console.error('[AMBASSADOR REQUEST] insert error:', error.message);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    // Fire-and-forget admin alert (don't block the response).
    sendAmbassadorRequestAlert(name, email, city, instagram_handle, reason)
      .catch(err => console.error('[EMAIL] ambassador request alert failed:', err));

    return NextResponse.json({
      success: true,
      message: "Thanks! We've received your request and will be in touch if there's a fit.",
    }, { status: 201 });
  } catch (err) {
    console.error('[AMBASSADOR REQUEST] error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

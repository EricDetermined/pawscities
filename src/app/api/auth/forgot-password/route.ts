export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/auth/forgot-password  { email }
 *
 * Custom password-reset delivery (2026-09-04, heuristic eval item 1).
 * WHY: supabase.auth.resetPasswordForEmail sends through Supabase's built-in
 * mailer, which is heavily rate-limited (~2-4/hour) and unreliable — resets
 * were arriving late or never. Every other Paw Cities email already goes
 * through Resend on our verified domain, so recovery links now do too:
 * generate the link server-side with the admin API, deliver it via Resend.
 *
 * Always responds success (no account enumeration).
 */
export async function POST(request: NextRequest) {
  let email: string | undefined;
  try { ({ email } = await request.json()); } catch { /* fallthrough */ }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  const generic = NextResponse.json({ success: true, message: 'If an account exists for that email, a reset link is on its way.' });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pawcities.com';
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: email.toLowerCase().trim(),
    options: { redirectTo: `${siteUrl}/auth/callback?type=recovery` },
  });

  if (error || !data?.properties?.hashed_token) {
    // Unknown account or transient error — same generic response either way.
    if (error) console.error('[FORGOT-PASSWORD] generateLink:', error.message);
    return generic;
  }

  // Link DIRECTLY to our callback with the hashed token (2026-09-04 fix).
  // WHY: action_link routes through Supabase's /auth/v1/verify, which uses the
  // implicit flow and returns tokens in the URL *hash fragment* — invisible to
  // our server-side /auth/callback, which then showed "link expired" even
  // though verification succeeded. token_hash goes through verifyOtp
  // server-side instead, which our callback already handles.
  const resetUrl = `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('[FORGOT-PASSWORD] RESEND_API_KEY not configured');
    return generic;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Paw Cities <alerts@pawcities.com>',
      to: [email.toLowerCase().trim()],
      subject: 'Reset your Paw Cities password',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#1e3a5f">🐾 Reset your password</h2>
        <p style="color:#334155;line-height:1.5">Someone (hopefully you) asked to reset the password for this Paw Cities account. Click below to choose a new one — the link expires in 1 hour.</p>
        <p style="margin:28px 0"><a href="${resetUrl}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Reset password</a></p>
        <p style="color:#94a3b8;font-size:12px;line-height:1.5">If you didn't request this, you can safely ignore this email — your password won't change.<br>Paw Cities · pawcities.com</p>
      </div>`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[FORGOT-PASSWORD] Resend send failed:', res.status, detail.slice(0, 200));
  }
  return generic;
}

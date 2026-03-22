import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/admin/create-business-account
 * Creates a verified Supabase Auth account with a temporary password
 * and sends credentials via Resend (bypasses Supabase email entirely)
 *
 * Body: { email, name, tempPassword }
 * Auth: CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, name, tempPassword } = await request.json();
  if (!email || !tempPassword) {
    return NextResponse.json({ error: 'email and tempPassword required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Delete existing account if it exists (clean slate)
  try {
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (existing) {
      await supabase.auth.admin.deleteUser(existing.id);
      console.log(`Deleted existing auth account for ${email}`);
    }
  } catch (e) {
    console.error('Error checking/deleting existing user:', e);
  }

  // Create fresh account with password and email confirmed
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: name || 'Business Owner', role: 'BUSINESS' },
  });

  if (createError) {
    return NextResponse.json({ error: `Failed to create account: ${createError.message}` }, { status: 500 });
  }

  // Send credentials via Resend (our working email system)
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const APP_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';

  const { error: emailError } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Paw Cities <noreply@pawcities.com>',
    to: email,
    subject: 'Your Paw Cities Business Account',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4f0;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:#ea580c;padding:24px 32px;">
  <span style="font-size:22px;font-weight:700;color:#fff;">&#128062; Paw Cities</span>
</td></tr>
<tr><td style="padding:32px;">
  <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Your Business Account is Ready</h1>
  <p style="font-size:15px;color:#4a4a4a;line-height:1.6;">Your business has been approved on Paw Cities! Here are your login credentials:</p>
  <table width="100%" cellpadding="12" cellspacing="0" style="margin:20px 0;border:2px solid #ea580c;border-radius:8px;background:#fef3e8;">
    <tr><td style="font-weight:600;width:100px;font-size:14px;color:#7c5a2e;">Email</td><td style="font-size:14px;color:#1a1a1a;">${email}</td></tr>
    <tr><td style="font-weight:600;font-size:14px;color:#7c5a2e;">Password</td><td style="font-size:14px;color:#1a1a1a;font-family:monospace;">${tempPassword}</td></tr>
  </table>
  <p style="font-size:14px;color:#ea580c;font-weight:600;">Please change your password after your first login.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
    <a href="${APP_URL}/login" style="display:inline-block;padding:14px 32px;background:#ea580c;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Sign In to Your Dashboard</a>
  </td></tr></table>
  <p style="font-size:13px;color:#888;">Once signed in, go to Photos to upload your business image and make your listing visible on Paw Cities.</p>
</td></tr>
<tr><td style="padding:24px 32px;background:#fef3e8;border-top:1px solid #fed7aa;">
  <p style="margin:0;font-size:12px;color:#9a7b5a;">Paw Cities &mdash; Dog-Friendly Places Worldwide</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
  });

  if (emailError) {
    return NextResponse.json({
      success: true,
      warning: `Account created but email failed: ${emailError.message}`,
      userId: newUser?.user?.id,
      tempPassword,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Account created and credentials sent to ${email}`,
    userId: newUser?.user?.id,
  });
}

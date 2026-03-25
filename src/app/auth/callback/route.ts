import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Map URL type params to Supabase verifyOtp types
function getOtpType(type: string): 'recovery' | 'email' | 'signup' | 'email_change' | 'invite' | 'magiclink' {
  switch (type) {
    case 'recovery':
      return 'recovery';
    case 'signup':
    case 'email':
      return 'email'; // Supabase uses 'email' type for signup confirmations
    case 'email_change':
      return 'email_change';
    case 'invite':
      return 'invite';
    case 'magiclink':
      return 'magiclink';
    default:
      return 'email';
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  // Validate redirect to prevent open redirect attacks
  const rawNext = requestUrl.searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const supabase = await createClient();

  // Token hash flow (from email templates) — no PKCE cookie needed
  if (token_hash && type) {
    const otpType = getOtpType(type);
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: otpType,
    });

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    // Log error for debugging
    console.error('verifyOtp error:', error.message, 'type:', type, 'otpType:', otpType);
  }

  // PKCE code flow (from OAuth, magic links, etc.)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    console.error('exchangeCodeForSession error:', error.message);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin));
}

export async function POST() {
  return NextResponse.json({ message: 'Method not supported' }, { status: 405 });
}

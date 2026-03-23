import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password recovery flow → send to reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
      }
      // All other flows (signup confirmation, magic link, etc.)
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin));
}

export async function POST() {
  return NextResponse.json({ message: 'Method not supported' }, { status: 405 });
}

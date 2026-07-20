import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createServerClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder-key',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if it exists
  const { data: { user } } = await supabase.auth.getUser();

  // Ambassador/referral attribution: persist ?ref= from any landing URL for 30 days
  // so signups and subscriptions can credit the referrer (see resolveSignupExtras).
  const refParam = request.nextUrl.searchParams.get('ref');

  // Gate account-only pages: send logged-out visitors to login with a return path
  // (prevents e.g. filling the whole "Add a Dog" form only to hit a 401 on submit)
  const { pathname } = request.nextUrl;
  if (!user && (pathname.startsWith('/profile') || pathname.startsWith('/feed'))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?redirect=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(loginUrl);
    if (refParam) {
      redirect.cookies.set('pc_ref', refParam.slice(0, 50), { maxAge: 60 * 60 * 24 * 30, path: '/' });
    }
    return redirect;
  }

  if (refParam) {
    response.cookies.set('pc_ref', refParam.slice(0, 50), { maxAge: 60 * 60 * 24 * 30, path: '/' });
  }

  return response;
}

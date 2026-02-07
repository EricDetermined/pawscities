import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Pass through all requests for now
  // Supabase auth session refresh will be re-enabled when auth is wired up
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

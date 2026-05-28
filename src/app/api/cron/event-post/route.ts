import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';

/**
 * GET /api/cron/event-post
 *
 * DEPRECATED: This cron has been unified into /api/cron/social-post.
 * All content (events, content bank, spotlights) now flows through a single
 * creative_queue → admin review → unified posting pipeline.
 *
 * This endpoint is kept as a redirect so existing Vercel cron config
 * doesn't break. It forwards to social-post which handles everything.
 *
 * TODO: Remove this cron from vercel.json once confirmed stable.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Forward to the unified posting cron
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const secret = process.env.CRON_SECRET;
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const url = `${baseUrl}/api/cron/social-post?secret=${secret}${dryRun ? '&dryRun=true' : ''}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(110000) });
    const data = await res.json();
    return NextResponse.json({
      ...data,
      _note: 'Forwarded from deprecated event-post cron to unified social-post pipeline',
    }, { status: res.status });
  } catch (error) {
    console.error('[EVENT-POST] Forward to social-post failed:', error);
    return NextResponse.json({
      status: 'error',
      error: 'Failed to forward to unified social-post cron',
      _note: 'This cron is deprecated. All posting flows through /api/cron/social-post now.',
    }, { status: 500 });
  }
}

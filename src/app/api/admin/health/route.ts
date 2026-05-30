export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

function getCronSecret() { return process.env.CRON_SECRET; }

export async function GET() {
  // Call the health check endpoint internally with skipEmail=true
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';

  try {
    const res = await fetch(
      `${baseUrl}/api/cron/health-check?secret=${getCronSecret()}&skipEmail=true`,
      { signal: AbortSignal.timeout(55000) }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Health check failed', status: res.status },
        { status: 500 }
      );
    }

    const report = await res.json();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: `Health check request failed: ${String(err)}` },
      { status: 500 }
    );
  }
}

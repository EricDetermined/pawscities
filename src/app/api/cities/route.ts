export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/community';

/** GET /api/cities — active cities for pickers (public, DB-driven so new cities appear automatically) */
export async function GET() {
  const admin = getServiceClient();
  const { data: cities, error } = await admin
    .from('cities')
    .select('slug, name, country')
    .eq('is_active', true)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { cities: cities || [] },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}

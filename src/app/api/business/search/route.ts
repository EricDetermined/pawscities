import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
  }

  try {
    // Search establishments by name or address (case-insensitive)
    const { data: establishments, error } = await supabase
      .from('establishments')
      .select('id, name, slug, address, city_id, primary_image, category_id, categories:category_id(name)')
      .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
      .order('name')
      .limit(20);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check which establishments already have claims
    const estIds = (establishments || []).map((e: { id: string }) => e.id);

    let claimedIds: Set<string> = new Set();
    if (estIds.length > 0) {
      const { data: claims } = await supabase
        .from('business_claims')
        .select('establishment_id, status')
        .in('establishment_id', estIds);

      if (claims) {
        claims.forEach((c: { establishment_id: string; status: string }) => {
          if (c.status === 'approved' || c.status === 'pending') {
            claimedIds.add(c.establishment_id);
          }
        });
      }
    }

    // Add claimed status to results
    const results = (establishments || []).map((est: Record<string, unknown>) => ({
      ...est,
      isClaimed: claimedIds.has(est.id as string),
    }));

    return NextResponse.json({ establishments: results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

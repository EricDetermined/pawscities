import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth is optional for search - allow unauthenticated users to search too
  const { data: { user } } = await supabase.auth.getUser();

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
  }

  try {
    // Non-claimable category IDs (parks, beaches)
    const nonClaimable = ['cat-park', 'cat-beach'];

    // Search establishments by name or address (case-insensitive)
    // Uses PascalCase Prisma table "Establishment" with camelCase columns
    const { data: establishments, error } = await supabase
      .from('Establishment')
      .select('id, name, slug, address, cityId, primaryImage, categoryId')
      .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
      .not('categoryId', 'in', `(${nonClaimable.join(',')})`)
      .eq('status', 'ACTIVE')
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
        .from('BusinessClaim')
        .select('establishmentId, status')
        .in('establishmentId', estIds);

      if (claims) {
        claims.forEach((c: { establishmentId: string; status: string }) => {
          if (c.status === 'APPROVED' || c.status === 'PENDING') {
            claimedIds.add(c.establishmentId);
          }
        });
      }
    }

    // Add claimed status and normalize column names for frontend
    const results = (establishments || []).map((est: Record<string, unknown>) => ({
      id: est.id,
      name: est.name,
      slug: est.slug,
      address: est.address,
      city_id: est.cityId,
      primary_image: est.primaryImage,
      category_id: est.categoryId,
      isClaimed: claimedIds.has(est.id as string),
    }));

    return NextResponse.json({ establishments: results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

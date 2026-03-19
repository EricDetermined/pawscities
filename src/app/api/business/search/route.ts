import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Non-claimable category slugs (parks, beaches are community-maintained)
const NON_CLAIMABLE_SLUGS = ['parks', 'beaches'];

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
    // First, get non-claimable category IDs by slug
    const { data: nonClaimableCats } = await supabase
      .from('categories')
      .select('id')
      .in('slug', NON_CLAIMABLE_SLUGS);

    const nonClaimableIds = (nonClaimableCats || []).map((c: { id: string }) => c.id);

    // Search establishments by name or address (case-insensitive)
    // Uses lowercase snake_case table and columns
    let queryBuilder = supabase
      .from('establishments')
      .select('id, name, slug, address, city_id, primary_image, category_id')
      .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
      .eq('status', 'ACTIVE')
      .order('name')
      .limit(20);

    // Filter out non-claimable categories if any exist
    if (nonClaimableIds.length > 0) {
      queryBuilder = queryBuilder.not('category_id', 'in', `(${nonClaimableIds.join(',')})`);
    }

    const { data: establishments, error } = await queryBuilder;

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
          if (c.status === 'APPROVED' || c.status === 'PENDING') {
            claimedIds.add(c.establishment_id);
          }
        });
      }
    }

    // Add claimed status to results
    const results = (establishments || []).map((est: Record<string, unknown>) => ({
      id: est.id,
      name: est.name,
      slug: est.slug,
      address: est.address,
      city_id: est.city_id,
      primary_image: est.primary_image,
      category_id: est.category_id,
      isClaimed: claimedIds.has(est.id as string),
    }));

    return NextResponse.json({ establishments: results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'PENDING';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
    const offset = (page - 1) * limit;

    // Validate status filter
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    const statusFilter = validStatuses.includes(status) ? status : 'PENDING';

    // Get total count
    const { count: totalCount } = await supabase
      .from('BusinessClaim')
      .select('*', { count: 'exact', head: true })
      .eq('status', statusFilter);

    // Get claims
    const { data: claims, error: claimsError } = await supabase
      .from('BusinessClaim')
      .select('*')
      .eq('status', statusFilter)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (claimsError) {
      throw new Error(`Failed to fetch claims: ${claimsError.message}`);
    }

    // Enrich claims with establishment and user data
    const enrichedClaims = await Promise.all(
      (claims || []).map(async (claim: Record<string, unknown>) => {
        const [estResult, userResult] = await Promise.all([
          supabase
            .from('Establishment')
            .select('id, name, slug, cityId, categoryId, status, tier')
            .eq('id', claim.establishmentId)
            .single(),
          supabase
            .from('User')
            .select('id, email, name')
            .eq('id', claim.userId)
            .single(),
        ]);

        return {
          ...claim,
          establishment: estResult.data,
          user: userResult.data,
        };
      })
    );

    return NextResponse.json({
      claims: enrichedClaims,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin claims GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

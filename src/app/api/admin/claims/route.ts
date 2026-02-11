import { createClient } from '@/lib/supabase/server';
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
    const status = searchParams.get('status') || 'pending';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
    const offset = (page - 1) * limit;

    // Validate status filter
    const validStatuses = ['pending', 'approved', 'rejected'];
    const statusFilter = validStatuses.includes(status) ? status : 'pending';

    // Get total count
    const { count: totalCount } = await supabase
      .from('business_claims')
      .select('*', { count: 'exact', head: true })
      .eq('status', statusFilter);

    // Get claims with user and establishment data
    const { data: claims, error: claimsError } = await supabase
      .from('business_claims')
      .select(`
        id,
        establishment_id,
        user_id,
        status,
        review_notes,
        created_at,
        updated_at,
        establishments(id, name, category, city_id, status, tier, claimed_by),
        users(id, email, display_name)
      `)
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (claimsError) {
      throw new Error(`Failed to fetch claims: ${claimsError.message}`);
    }

    return NextResponse.json({
      claims: claims || [],
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

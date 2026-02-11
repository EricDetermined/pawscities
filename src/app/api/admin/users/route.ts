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
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const suspended = searchParams.get('suspended');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase.from('users').select(`
      id,
      supabase_id,
      email,
      display_name,
      role,
      suspended,
      avatar_url,
      created_at,
      updated_at
    `, { count: 'exact' });

    // Apply filters
    if (role) {
      query = query.eq('role', role);
    }

    if (suspended !== null && suspended !== undefined) {
      query = query.eq('suspended', suspended === 'true');
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    const { data: users, count: totalCount, error: usersError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin users GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

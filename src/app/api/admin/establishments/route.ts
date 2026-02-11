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
    const city = searchParams.get('city');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const tier = searchParams.get('tier');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const offset = (page - 1) * limit;
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Validate sortBy
    const validSortFields = ['rating', 'name', 'created_at', 'review_count'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';

    // Build query with correct column names
    let query = supabase.from('establishments').select(`
      id,
      name,
      slug,
      category_id,
      city_id,
      status,
      tier,
      rating,
      review_count,
      claimed_by,
      is_verified,
      is_featured,
      address,
      neighborhood,
      created_at,
      updated_at,
      cities(id, name, slug),
      categories(id, name, slug)
    `, { count: 'exact' });

    // Apply filters
    if (city) {
      // Support both city slug and city UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(city);
      if (isUUID) {
        query = query.eq('city_id', city);
      } else {
        // Look up city ID from slug
        const { data: cityData } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', city)
          .single();
        if (cityData) {
          query = query.eq('city_id', cityData.id);
        }
      }
    }

    if (category) {
      // Support both category slug and category UUID
      const isCatUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
      if (isCatUUID) {
        query = query.eq('category_id', category);
      } else {
        const { data: catData } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', category)
          .single();
        if (catData) {
          query = query.eq('category_id', catData.id);
        }
      }
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (tier) {
      query = query.eq('tier', tier);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    const { data: establishments, count: totalCount, error: estError } = await query
      .order(sortField, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (estError) {
      throw new Error(`Failed to fetch establishments: ${estError.message}`);
    }

    return NextResponse.json({
      establishments: establishments || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin establishments GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch establishments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;
    const body = await request.json();

    const {
      name,
      description,
      category,
      city_id,
      address,
      phone,
      email,
      website,
      hours,
      image_url,
    } = body;

    // Validate required fields
    if (!name || !category || !city_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, city_id' },
        { status: 400 }
      );
    }

    // Create establishment
    const { data: establishment, error: createError } = await supabase
      .from('establishments')
      .insert([
        {
          name,
          description: description || null,
          category_id: category,
          city_id,
          address: address || '',
          phone: phone || null,
          email: email || null,
          website: website || null,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          status: 'ACTIVE',
          tier: 'free',
          rating: 0,
          review_count: 0,
        },
      ])
      .select();

    if (createError) {
      throw new Error(`Failed to create establishment: ${createError.message}`);
    }

    return NextResponse.json(establishment?.[0], { status: 201 });
  } catch (error) {
    console.error('Admin establishment POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create establishment' },
      { status: 500 }
    );
  }
}

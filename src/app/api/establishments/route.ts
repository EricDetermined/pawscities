import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const cityId = searchParams.get('cityId');
  const categoryId = searchParams.get('categoryId');
  const featured = searchParams.get('featured');
  const verified = searchParams.get('verified');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('establishments')
    .select('*, categories:category_id(name, name_fr, icon, slug)', { count: 'exact' })
    .eq('status', 'ACTIVE')
    .order('is_featured', { ascending: false })
    .order('rating', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (cityId) query = query.eq('city_id', cityId);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (featured === 'true') query = query.eq('is_featured', true);
  if (verified === 'true') query = query.eq('is_verified', true);
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

  const { data: establishments, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    establishments: establishments || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const { name, cityId, categoryId, address, latitude, longitude, description, phone, email, website } = body;

  if (!name || !cityId || !categoryId || !address || !description) {
    return NextResponse.json({ error: 'Name, city, category, address, and description are required' }, { status: 400 });
  }

  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const { data: establishment, error } = await supabase
    .from('establishments')
    .insert({
      name,
      slug,
      city_id: cityId,
      category_id: categoryId,
      address,
      latitude: latitude || 0,
      longitude: longitude || 0,
      description,
      phone: phone || null,
      email: email || null,
      website: website || null,
      status: 'PENDING',
      source: 'user_submission',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ establishment }, { status: 201 });
}

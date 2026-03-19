import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get('establishmentId');
  const userId = searchParams.get('userId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('reviews')
    .select('*, users:user_id(name, avatar)', { count: 'exact' })
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (establishmentId) {
    query = query.eq('establishment_id', establishmentId);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: reviews, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reviews: reviews || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const { establishmentId, rating, title, content, dogFriendliness, serviceRating, valueRating, dogNames, visitDate } = body;

  if (!establishmentId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Establishment ID and rating (1-5) are required' }, { status: 400 });
  }

  let { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    const { data: newUser } = await supabaseAdmin
      .from('users')
      .insert({
        supabase_id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Dog Lover',
      })
      .select('id')
      .single();
    dbUser = newUser;
  }

  if (!dbUser) {
    return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });
  }

  // Check for existing review
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', dbUser.id)
    .eq('establishment_id', establishmentId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'You have already reviewed this place' }, { status: 409 });
  }

  const { data: review, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      user_id: dbUser.id,
      establishment_id: establishmentId,
      rating,
      title: title || null,
      content: content || null,
      dog_friendliness: dogFriendliness || null,
      service_rating: serviceRating || null,
      value_rating: valueRating || null,
      dog_names: dogNames || null,
      visit_date: visitDate || null,
      status: 'APPROVED',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update establishment rating
  const { data: allReviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('establishment_id', establishmentId)
    .eq('status', 'APPROVED');

  if (allReviews && allReviews.length > 0) {
    const avgRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length;
    await supabaseAdmin
      .from('establishments')
      .update({ rating: Math.round(avgRating * 10) / 10, review_count: allReviews.length })
      .eq('id', establishmentId);
  }

  // Create activity
  await supabaseAdmin.from('activities').insert({
    user_id: dbUser.id,
    activity_type: 'REVIEW_POSTED',
    entity_id: review.id,
    entity_type: 'review',
  });

  return NextResponse.json({ review }, { status: 201 });
}

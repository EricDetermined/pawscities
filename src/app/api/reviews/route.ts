import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get('establishmentId');
  const userId = searchParams.get('userId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('Review')
    .select('*, User:userId(name, avatar)', { count: 'exact' })
    .eq('status', 'APPROVED')
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1);

  if (establishmentId) {
    query = query.eq('establishmentId', establishmentId);
  }
  if (userId) {
    query = query.eq('userId', userId);
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
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser) {
    const { data: newUser } = await supabase
      .from('User')
      .insert({
        supabaseId: user.id,
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
    .from('Review')
    .select('id')
    .eq('userId', dbUser.id)
    .eq('establishmentId', establishmentId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'You have already reviewed this place' }, { status: 409 });
  }

  const { data: review, error } = await supabase
    .from('Review')
    .insert({
      userId: dbUser.id,
      establishmentId,
      rating,
      title: title || null,
      content: content || null,
      dogFriendliness: dogFriendliness || null,
      serviceRating: serviceRating || null,
      valueRating: valueRating || null,
      dogNames: dogNames || null,
      visitDate: visitDate || null,
      status: 'APPROVED',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update establishment rating
  const { data: allReviews } = await supabase
    .from('Review')
    .select('rating')
    .eq('establishmentId', establishmentId)
    .eq('status', 'APPROVED');

  if (allReviews && allReviews.length > 0) {
    const avgRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length;
    await supabase
      .from('Establishment')
      .update({ rating: Math.round(avgRating * 10) / 10, reviewCount: allReviews.length })
      .eq('id', establishmentId);
  }

  // Create activity
  await supabase.from('Activity').insert({
    userId: dbUser.id,
    type: 'REVIEW_POSTED',
    reviewId: review.id,
    establishmentId,
  });

  return NextResponse.json({ review }, { status: 201 });
}

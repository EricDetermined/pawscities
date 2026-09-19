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
    .select('*, users:user_id(name, avatar), establishments:establishment_id(name, slug, city_id, primary_image), review_responses(response, responded_at)', { count: 'exact' })
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
    .select('id, name')
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
      .select('id, name')
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

  // Create activity (schema columns: type / review_id / establishment_id)
  const { error: activityError } = await supabaseAdmin.from('activities').insert({
    user_id: dbUser.id,
    type: 'review',
    review_id: review.id,
    establishment_id: establishmentId,
  });
  if (activityError) {
    console.error('Failed to record review activity:', activityError.message);
  }

  // Notify the business owner (fire-and-forget; never block the reviewer).
  // Free-tier owners get an upgrade CTA — this is the highest-intent upgrade
  // moment there is (2026-09-20, per Eric).
  (async () => {
    try {
      const { data: est } = await supabaseAdmin
        .from('establishments')
        .select('id, name, slug, claimed_by, cities(slug)')
        .eq('id', establishmentId)
        .single();
      if (!est?.claimed_by) return; // unclaimed listing → nobody to notify
      const { data: owner } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', est.claimed_by)
        .single();
      if (!owner?.email) return;
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('tier')
        .eq('establishment_id', establishmentId)
        .eq('status', 'ACTIVE')
        .single();
      const isFree = (sub?.tier || 'free') === 'free';
      const citySlug = Array.isArray(est.cities) ? est.cities[0]?.slug : (est.cities as { slug?: string } | null)?.slug;
      const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pawcities.com';
      const listingUrl = citySlug ? `${base}/${citySlug}/${est.slug}` : base;
      const { sendReviewNotification } = await import('@/lib/email');
      await sendReviewNotification(
        owner.email, est.name, dbUser.name || 'A dog parent',
        rating, content || null, listingUrl, isFree,
      );
    } catch (e) {
      console.error('[REVIEWS] owner notification failed (non-blocking):', e);
    }
  })();

  return NextResponse.json({ review }, { status: 201 });
}

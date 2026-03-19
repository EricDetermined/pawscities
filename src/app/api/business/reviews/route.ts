import { requireBusinessOrAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the business's approved claim
    const { data: claim, error: claimError } = await supabase
      .from('business_claims')
      .select('establishment_id')
      .eq('user_id', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Get reviews for this establishment
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*, users:user_id(id, name, avatar)')
      .eq('establishment_id', claim.establishment_id)
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });

    if (reviewsError) {
      return NextResponse.json({ error: reviewsError.message }, { status: 500 });
    }

    // Get review responses from business
    const { data: responses, error: responsesError } = await supabase
      .from('review_responses')
      .select('*')
      .eq('establishment_id', claim.establishment_id);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
    }

    const responseMap = new Map();
    responses?.forEach((r: any) => {
      responseMap.set(r.review_id, r);
    });

    // Enrich reviews with responses
    const enrichedReviews = reviews?.map((review: any) => ({
      ...review,
      businessResponse: responseMap.get(review.id) || null,
    })) || [];

    // Calculate average rating
    const avgRating =
      enrichedReviews.length > 0
        ? (enrichedReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / enrichedReviews.length).toFixed(1)
        : 0;

    return NextResponse.json({
      reviews: enrichedReviews,
      summary: {
        totalReviews: enrichedReviews.length,
        avgRating: parseFloat(String(avgRating)),
        responseRate: responses ? (responses.length / enrichedReviews.length * 100).toFixed(0) : '0',
      },
    });
  } catch (error) {
    console.error('Reviews GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { reviewId, response } = body;

    if (!reviewId || !response) {
      return NextResponse.json({ error: 'Review ID and response text are required' }, { status: 400 });
    }

    // Get the business's approved claim
    const { data: claim, error: claimError } = await supabase
      .from('business_claims')
      .select('establishment_id')
      .eq('user_id', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Verify the review belongs to this establishment
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .eq('establishment_id', claim.establishment_id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Check if response already exists
    const { data: existing } = await supabase
      .from('review_responses')
      .select('id')
      .eq('review_id', reviewId)
      .single();

    let result;
    if (existing) {
      // Update existing response
      const { data: updated, error: updateError } = await supabase
        .from('review_responses')
        .update({ response, updated_at: new Date().toISOString() })
        .eq('review_id', reviewId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      result = updated;
    } else {
      // Create new response
      const { data: created, error: createError } = await supabase
        .from('review_responses')
        .insert({
          review_id: reviewId,
          establishment_id: claim.establishment_id,
          response,
          responded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      result = created;
    }

    return NextResponse.json({ response: result });
  } catch (error) {
    console.error('Reviews POST error:', error);
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
  }
}

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
      .from('BusinessClaim')
      .select('establishmentId')
      .eq('userId', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Get reviews for this establishment
    const { data: reviews, error: reviewsError } = await supabase
      .from('Review')
      .select('*, User:userId(id, name, avatar)')
      .eq('establishmentId', claim.establishmentId)
      .eq('status', 'APPROVED')
      .order('createdAt', { ascending: false });

    if (reviewsError) {
      return NextResponse.json({ error: reviewsError.message }, { status: 500 });
    }

    // Get review responses from business
    const { data: responses, error: responsesError } = await supabase
      .from('ReviewResponse')
      .select('*')
      .eq('establishmentId', claim.establishmentId);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
    }

    const responseMap = new Map();
    responses?.forEach((r: any) => {
      responseMap.set(r.reviewId, r);
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
      .from('BusinessClaim')
      .select('establishmentId')
      .eq('userId', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Verify the review belongs to this establishment
    const { data: review, error: reviewError } = await supabase
      .from('Review')
      .select('id')
      .eq('id', reviewId)
      .eq('establishmentId', claim.establishmentId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Check if response already exists
    const { data: existing } = await supabase
      .from('ReviewResponse')
      .select('id')
      .eq('reviewId', reviewId)
      .single();

    let result;
    if (existing) {
      // Update existing response
      const { data: updated, error: updateError } = await supabase
        .from('ReviewResponse')
        .update({ response, updatedAt: new Date().toISOString() })
        .eq('reviewId', reviewId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      result = updated;
    } else {
      // Create new response
      const { data: created, error: createError } = await supabase
        .from('ReviewResponse')
        .insert({
          reviewId,
          establishmentId: claim.establishmentId,
          response,
          respondedAt: new Date().toISOString(),
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

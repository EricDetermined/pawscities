import { requireBusinessOrAdmin, getEstablishmentForUser } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const { error, supabase, user, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !user || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the establishment for this user (handles admin fallback)
    const result = await getEstablishmentForUser(supabase, dbUser);

    if (!result) {
      // Check for pending claim
      const { data: pendingClaim } = await supabase
        .from('business_claims')
        .select('id, status')
        .eq('user_id', dbUser.id)
        .eq('status', 'PENDING')
        .single();

      return NextResponse.json({
        status: pendingClaim ? 'pending' : 'no_claim',
        message: pendingClaim ? 'Your claim is pending review' : 'No business claim found',
        establishment: null,
        analytics: null,
        subscription: null,
      });
    }

    const claim = result.claim;

    // Get the establishment
    const { data: establishment } = await supabase
      .from('establishments')
      .select('*')
      .eq('id', claim.establishment_id)
      .single();

    if (!establishment) {
      return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
    }

    // Get reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('establishment_id', establishment.id)
      .eq('status', 'APPROVED');

    const totalReviews = reviews?.length || 0;
    const avgRating =
      totalReviews > 0
        ? (reviews!.reduce((sum: number, r: Record<string, unknown>) => sum + (r.rating as number), 0) / totalReviews).toFixed(1)
        : 0;

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('establishment_id', establishment.id)
      .single();

    const tier = subscription?.tier || establishment.tier || 'free';

    return NextResponse.json({
      status: 'approved',
      establishment: {
        id: establishment.id,
        name: establishment.name,
        slug: establishment.slug,
        address: establishment.address,
        description: establishment.description,
        website: establishment.website,
        primaryImage: establishment.primary_image,
        cityId: establishment.city_id,
        categoryId: establishment.category_id,
        tier: establishment.tier,
      },
      analytics: {
        totalReviews,
        avgRating: parseFloat(String(avgRating)),
        rating: establishment.rating,
        reviewCount: establishment.review_count,
      },
      subscription: {
        tier,
        isPremium: tier !== 'free',
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}

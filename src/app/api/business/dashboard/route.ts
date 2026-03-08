import { requireBusinessOrAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const { error, supabase, user, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !user || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the business's approved claim with establishment details
    const { data: claim, error: claimError } = await supabase
      .from('BusinessClaim')
      .select('*')
      .eq('userId', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError && claimError.code !== 'PGRST116') {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    if (!claim) {
      // Check for pending claim
      const { data: pendingClaim } = await supabase
        .from('BusinessClaim')
        .select('id, status')
        .eq('userId', dbUser.id)
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

    // Get the establishment
    const { data: establishment } = await supabase
      .from('Establishment')
      .select('*')
      .eq('id', claim.establishmentId)
      .single();

    if (!establishment) {
      return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
    }

    // Get reviews
    const { data: reviews } = await supabase
      .from('Review')
      .select('rating')
      .eq('establishmentId', establishment.id)
      .eq('status', 'APPROVED');

    const totalReviews = reviews?.length || 0;
    const avgRating =
      totalReviews > 0
        ? (reviews!.reduce((sum: number, r: Record<string, unknown>) => sum + (r.rating as number), 0) / totalReviews).toFixed(1)
        : 0;

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('Subscription')
      .select('*')
      .eq('establishmentId', establishment.id)
      .single();

    const tier = subscription?.tier || establishment.tier || 'FREE';

    return NextResponse.json({
      status: 'approved',
      establishment: {
        id: establishment.id,
        name: establishment.name,
        slug: establishment.slug,
        address: establishment.address,
        description: establishment.description,
        website: establishment.website,
        primaryImage: establishment.primaryImage,
        cityId: establishment.cityId,
        categoryId: establishment.categoryId,
        tier: establishment.tier,
      },
      analytics: {
        totalReviews,
        avgRating: parseFloat(String(avgRating)),
        rating: establishment.rating,
        reviewCount: establishment.reviewCount,
      },
      subscription: {
        tier,
        isPremium: tier !== 'FREE',
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}

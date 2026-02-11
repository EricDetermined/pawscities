import { requireBusinessOrAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { error, supabase, user, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !user || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the business's approved claim
    const { data: claim, error: claimError } = await supabase
      .from('BusinessClaim')
      .select('*, Establishment:establishmentId(*)')
      .eq('userId', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError && claimError.code !== 'PGRST116') {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    if (!claim) {
      // No approved claim - return pending message
      return NextResponse.json({
        status: 'pending',
        message: 'Your claim is pending review',
        establishment: null,
        analytics: null,
        subscription: null,
      });
    }

    const establishment = claim.Establishment;

    // Get analytics for this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: views, error: viewsError } = await supabase
      .from('PageView')
      .select('id', { count: 'exact' })
      .eq('establishmentId', establishment.id)
      .gte('createdAt', monthStart.toISOString())
      .lte('createdAt', now.toISOString());

    const { data: reviews, error: reviewsError } = await supabase
      .from('Review')
      .select('rating', { count: 'exact' })
      .eq('establishmentId', establishment.id)
      .eq('status', 'APPROVED');

    const totalViews = views?.length || 0;
    const totalReviews = reviews?.length || 0;
    const avgRating =
      totalReviews > 0
        ? (reviews!.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews).toFixed(1)
        : 0;

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('Subscription')
      .select('*')
      .eq('establishmentId', establishment.id)
      .single();

    const tier = subscription?.tier || 'free';

    return NextResponse.json({
      status: 'approved',
      establishment: {
        id: establishment.id,
        name: establishment.name,
        address: establishment.address,
        phone: establishment.phone,
        website: establishment.website,
        image: establishment.primaryImage,
      },
      analytics: {
        viewsThisMonth: totalViews,
        totalReviews,
        avgRating: parseFloat(String(avgRating)),
      },
      subscription: {
        tier,
        isPremium: tier === 'premium',
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}

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
      .from('business_claims')
      .select('*, establishments:establishment_id(*)')
      .eq('user_id', dbUser.id)
      .eq('status', 'approved')
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

    const establishment = claim.establishments;

    // Get analytics for this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: views } = await supabase
      .from('analytics_events')
      .select('id', { count: 'exact' })
      .eq('establishment_id', establishment.id)
      .eq('event_type', 'page_view')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', now.toISOString());

    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating', { count: 'exact' })
      .eq('establishment_id', establishment.id)
      .eq('status', 'approved');

    const totalViews = views?.length || 0;
    const totalReviews = reviews?.length || 0;
    const avgRating =
      totalReviews > 0
        ? (reviews!.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews).toFixed(1)
        : 0;

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('establishment_id', establishment.id)
      .single();

    const tier = subscription?.plan || 'free';

    return NextResponse.json({
      status: 'approved',
      establishment: {
        id: establishment.id,
        name: establishment.name,
        address: establishment.address,
        phone: establishment.phone,
        website: establishment.website,
        image: establishment.image_url,
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

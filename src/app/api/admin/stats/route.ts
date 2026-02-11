import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;

    // Get total cities
    const { count: citiesCount } = await supabase
      .from('cities')
      .select('*', { count: 'exact', head: true });

    // Get total establishments
    const { count: establishmentsCount } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    // Get total users
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('suspended', false);

    // Get pending claims count
    const { count: pendingClaimsCount } = await supabase
      .from('business_claims')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get new users this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newUsersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo);

    // Get premium listings count
    const { count: premiumCount } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'premium');

    // Get recent activities (last 10)
    const { data: recentActivities, error: activitiesError } = await supabase
      .from('analytics_events')
      .select('id, event_type, created_at, user_id, establishment_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activitiesError) {
      throw new Error(`Failed to fetch activities: ${activitiesError.message}`);
    }

    return NextResponse.json({
      stats: {
        totalCities: citiesCount || 0,
        totalEstablishments: establishmentsCount || 0,
        totalUsers: usersCount || 0,
        pendingClaims: pendingClaimsCount || 0,
        newUsersThisWeek: newUsersCount || 0,
        premiumListings: premiumCount || 0,
      },
      recentActivities: recentActivities || [],
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

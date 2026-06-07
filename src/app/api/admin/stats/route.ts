export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CONTENT_BANK } from '@/lib/social-content';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = authResult.supabase!;
    const admin = getSupabaseAdmin();

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split('T')[0];

    // ── Run all queries in parallel, tolerating individual failures ────
    const safe = <T,>(promise: PromiseLike<T>, label: string): Promise<T> =>
      Promise.resolve(promise).catch((err) => {
        console.error(`[admin/stats] Query failed: ${label}`, err);
        return { data: null, count: 0, error: err } as unknown as T;
      });

    const [
      cities, establishments, users, pendingClaims, newUsers, premium,
      recentActivity,
      pendingEvents, approvedEvents, totalEvents,
      subscribers, newSubscribers,
      socialOpportunities, unrepliedComments, socialPosts,
      recentPosts, pendingEventsData,
    ] = await Promise.all([
      // Core stats
      safe(supabase.from('cities').select('*', { count: 'exact', head: true }), 'cities'),
      safe(supabase.from('establishments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'), 'establishments'),
      safe(supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_suspended', false), 'users'),
      safe(supabase.from('business_claims').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'), 'pendingClaims'),
      safe(supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo), 'newUsers'),
      safe(supabase.from('establishments').select('*', { count: 'exact', head: true }).eq('tier', 'premium'), 'premium'),

      // Recent activity
      safe(supabase.from('analytics_events')
        .select('id, event_type, created_at, user_id, establishment_id')
        .order('created_at', { ascending: false }).limit(10), 'recentActivity'),

      // Events stats
      safe(supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'), 'pendingEvents'),
      safe(supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('start_date', today), 'approvedEvents'),
      safe(supabase.from('events').select('*', { count: 'exact', head: true }), 'totalEvents'),

      // Subscriber stats (use admin client for service_role access)
      safe(admin ? admin.from('subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active') : Promise.resolve({ count: 0, data: null, error: null, status: 200, statusText: 'OK' } as any), 'subscribers'),
      safe(admin ? admin.from('subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', oneWeekAgo) : Promise.resolve({ count: 0, data: null, error: null, status: 200, statusText: 'OK' } as any), 'newSubscribers'),

      // Social queue stats
      safe(supabase.from('social_opportunities').select('*', { count: 'exact', head: true }).eq('status', 'new'), 'socialOpportunities'),
      safe(supabase.from('social_comments').select('*', { count: 'exact', head: true }).eq('replied', false), 'unrepliedComments'),
      safe(supabase.from('social_posts').select('*', { count: 'exact', head: true }).eq('status', 'published'), 'socialPosts'),

      // Recent social posts (last 5)
      safe(supabase.from('social_posts')
        .select('id, headline, city, status, likes, comments_count, created_at, error_message')
        .order('created_at', { ascending: false }).limit(5), 'recentPosts'),

      // Pending events for inline approval (last 10)
      safe(supabase.from('events')
        .select('id, name, start_date, end_date, venue_name, source, source_handle, external_url, discovery_score, created_at, cities!inner(name, slug)')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(10), 'pendingEventsData'),
    ]);

    // Compute content remaining
    const publishedCount = socialPosts.count || 0;
    const contentRemaining = CONTENT_BANK.length - publishedCount;

    // Last post date
    const lastPost = recentPosts.data?.[0];
    const lastPostDate = lastPost?.created_at || null;

    return NextResponse.json({
      stats: {
        totalCities: cities.count || 0,
        totalEstablishments: establishments.count || 0,
        totalUsers: users.count || 0,
        pendingClaims: pendingClaims.count || 0,
        newUsersThisWeek: newUsers.count || 0,
        premiumListings: premium.count || 0,
      },
      events: {
        pending: pendingEvents.count || 0,
        upcoming: approvedEvents.count || 0,
        total: totalEvents.count || 0,
      },
      subscribers: {
        total: subscribers.count || 0,
        newThisWeek: newSubscribers.count || 0,
      },
      social: {
        newOpportunities: socialOpportunities.count || 0,
        unrepliedComments: unrepliedComments.count || 0,
        totalPublished: publishedCount,
        contentRemaining,
        lastPostDate,
        recentPosts: recentPosts.data || [],
      },
      pendingEventsData: pendingEventsData.data || [],
      recentActivities: recentActivity.data || [],
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({
      error: 'Failed to fetch stats',
      debug: error?.message || String(error),
      stack: error?.stack?.split('\n').slice(0, 5),
    }, { status: 500 });
  }
}

import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;

    // Get date range for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get page views by day for last 30 days
    const { data: pageViewsData, error: pageViewsError } = await supabase
      .from('analytics_events')
      .select('created_at')
      .eq('event_type', 'page_view')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    // Process page views by day (don't fail if table doesn't exist yet)
    const pageViewsByDay: Record<string, number> = {};
    if (!pageViewsError) {
      pageViewsData?.forEach((event: any) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        pageViewsByDay[date] = (pageViewsByDay[date] || 0) + 1;
      });
    }

    // Get top establishments by views
    const { data: topEstablishmentsData } = await supabase
      .from('analytics_events')
      .select('establishment_id')
      .eq('event_type', 'page_view')
      .not('establishment_id', 'is', null)
      .gte('created_at', thirtyDaysAgo);

    const establishmentViewCounts: Record<string, number> = {};
    topEstablishmentsData?.forEach((event: any) => {
      if (event.establishment_id) {
        establishmentViewCounts[event.establishment_id] =
          (establishmentViewCounts[event.establishment_id] || 0) + 1;
      }
    });

    // Get establishment details for top 10
    const topEstIds = Object.entries(establishmentViewCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    let topEstablishmentsWithCounts: any[] = [];
    if (topEstIds.length > 0) {
      const { data: topEstablishments } = await supabase
        .from('establishments')
        .select('id, name, category_id')
        .in('id', topEstIds);

      topEstablishmentsWithCounts = (topEstablishments || [])
        .map((est: any) => ({
          id: est.id,
          name: est.name,
          views: establishmentViewCounts[est.id],
        }))
        .sort((a: any, b: any) => b.views - a.views);
    }

    // Get top search queries
    const { data: searchEventsData } = await supabase
      .from('analytics_events')
      .select('search_query')
      .eq('event_type', 'search')
      .gte('created_at', thirtyDaysAgo)
      .not('search_query', 'is', null);

    const searchQueryCounts: Record<string, number> = {};
    searchEventsData?.forEach((event: any) => {
      if (event.search_query) {
        searchQueryCounts[event.search_query] =
          (searchQueryCounts[event.search_query] || 0) + 1;
      }
    });

    const topSearchQueries = Object.entries(searchQueryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Get user signups by day for last 30 days
    const { data: signupData } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    const signupsByDay: Record<string, number> = {};
    signupData?.forEach((user: any) => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      signupsByDay[date] = (signupsByDay[date] || 0) + 1;
    });

    return NextResponse.json({
      analytics: {
        pageViewsByDay,
        topEstablishments: topEstablishmentsWithCounts,
        topSearchQueries,
        signupsByDay,
      },
      period: {
        startDate: thirtyDaysAgo,
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

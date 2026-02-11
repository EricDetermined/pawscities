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

    // Get date range for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get page views by day for last 30 days
    const { data: pageViewsData, error: pageViewsError } = await supabase
      .from('analytics_events')
      .select('created_at')
      .eq('event_type', 'page_view')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    if (pageViewsError) {
      throw new Error(`Failed to fetch page views: ${pageViewsError.message}`);
    }

    // Process page views by day
    const pageViewsByDay: Record<string, number> = {};
    pageViewsData?.forEach((event) => {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      pageViewsByDay[date] = (pageViewsByDay[date] || 0) + 1;
    });

    // Get top establishments by views
    const { data: topEstablishmentsData, error: topEstError } = await supabase
      .from('analytics_events')
      .select('establishment_id')
      .eq('event_type', 'establishment_view')
      .gte('created_at', thirtyDaysAgo);

    if (topEstError) {
      throw new Error(`Failed to fetch establishment views: ${topEstError.message}`);
    }

    const establishmentViewCounts: Record<string, number> = {};
    topEstablishmentsData?.forEach((event) => {
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

    const { data: topEstablishments, error: estDetailsError } = await supabase
      .from('establishments')
      .select('id, name, category')
      .in('id', topEstIds);

    if (estDetailsError) {
      throw new Error(`Failed to fetch establishment details: ${estDetailsError.message}`);
    }

    const topEstablishmentsWithCounts = topEstablishments?.map((est) => ({
      ...est,
      views: establishmentViewCounts[est.id],
    })) || [];

    // Get top search queries
    const { data: searchEventsData, error: searchError } = await supabase
      .from('analytics_events')
      .select('query_string')
      .eq('event_type', 'search')
      .gte('created_at', thirtyDaysAgo)
      .not('query_string', 'is', null);

    if (searchError) {
      throw new Error(`Failed to fetch search queries: ${searchError.message}`);
    }

    const searchQueryCounts: Record<string, number> = {};
    searchEventsData?.forEach((event) => {
      if (event.query_string) {
        searchQueryCounts[event.query_string] =
          (searchQueryCounts[event.query_string] || 0) + 1;
      }
    });

    const topSearchQueries = Object.entries(searchQueryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Get user signups by day for last 30 days
    const { data: signupData, error: signupError } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    if (signupError) {
      throw new Error(`Failed to fetch signup data: ${signupError.message}`);
    }

    const signupsByDay: Record<string, number> = {};
    signupData?.forEach((user) => {
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

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
      .from('ClickEvent')
      .select('createdAt')
      .eq('eventType', 'page_view')
      .gte('createdAt', thirtyDaysAgo)
      .order('createdAt', { ascending: true });

    if (pageViewsError) {
      throw new Error(`Failed to fetch page views: ${pageViewsError.message}`);
    }

    // Process page views by day
    const pageViewsByDay: Record<string, number> = {};
    pageViewsData?.forEach((event) => {
      const date = new Date(event.createdAt).toISOString().split('T')[0];
      pageViewsByDay[date] = (pageViewsByDay[date] || 0) + 1;
    });

    // Get top establishments by views (page_view events with establishmentId set)
    const { data: topEstablishmentsData, error: topEstError } = await supabase
      .from('ClickEvent')
      .select('establishmentId')
      .eq('eventType', 'page_view')
      .not('establishmentId', 'is', null)
      .gte('createdAt', thirtyDaysAgo);

    if (topEstError) {
      throw new Error(`Failed to fetch establishment views: ${topEstError.message}`);
    }

    const establishmentViewCounts: Record<string, number> = {};
    topEstablishmentsData?.forEach((event) => {
      if (event.establishmentId) {
        establishmentViewCounts[event.establishmentId] =
          (establishmentViewCounts[event.establishmentId] || 0) + 1;
      }
    });

    // Get establishment details for top 10
    const topEstIds = Object.entries(establishmentViewCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    let topEstablishmentsWithCounts: any[] = [];
    if (topEstIds.length > 0) {
      const { data: topEstablishments, error: estDetailsError } = await supabase
        .from('Establishment')
        .select('id, name, categoryId, Category(name)')
        .in('id', topEstIds);

      if (estDetailsError) {
        throw new Error(`Failed to fetch establishment details: ${estDetailsError.message}`);
      }

      topEstablishmentsWithCounts = (topEstablishments || [])
        .map((est: any) => ({
          id: est.id,
          name: est.name,
          category: est.Category?.name || 'Unknown',
          views: establishmentViewCounts[est.id],
        }))
        .sort((a: any, b: any) => b.views - a.views);
    }

    // Get top search queries
    const { data: searchEventsData, error: searchError } = await supabase
      .from('SearchEvent')
      .select('queryString')
      .eq('eventType', 'search')
      .gte('createdAt', thirtyDaysAgo)
      .not('queryString', 'is', null);

    if (searchError) {
      throw new Error(`Failed to fetch search queries: ${searchError.message}`);
    }

    const searchQueryCounts: Record<string, number> = {};
    searchEventsData?.forEach((event: any) => {
      if (event.queryString) {
        searchQueryCounts[event.queryString] =
          (searchQueryCounts[event.queryString] || 0) + 1;
      }
    });

    const topSearchQueries = Object.entries(searchQueryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Get user signups by day for last 30 days
    const { data: signupData, error: signupError } = await supabase
      .from('User')
      .select('createdAt')
      .gte('createdAt', thirtyDaysAgo)
      .order('createdAt', { ascending: true });

    if (signupError) {
      throw new Error(`Failed to fetch signup data: ${signupError.message}`);
    }

    const signupsByDay: Record<string, number> = {};
    signupData?.forEach((user) => {
      const date = new Date(user.createdAt).toISOString().split('T')[0];
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

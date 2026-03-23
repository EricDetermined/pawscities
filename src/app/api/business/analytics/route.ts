import { requireBusinessOrAdmin, getEstablishmentForUser } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the establishment for this user (handles admin fallback)
    const result = await getEstablishmentForUser(supabase, dbUser);

    if (!result) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    const establishmentId = result.establishmentId;

    // Parse date range from query params (Premium feature), default to 30 days
    const searchParams = request.nextUrl.searchParams;
    const now = new Date();
    const endDate = searchParams.get('end')
      ? new Date(searchParams.get('end')! + 'T23:59:59.999Z')
      : now;
    const startDate = searchParams.get('start')
      ? new Date(searchParams.get('start')! + 'T00:00:00.000Z')
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('establishment_id', establishmentId)
      .eq('status', 'ACTIVE')
      .single();

    const tier = subscription?.tier || 'free';

    // Get click events for the date range
    // Table is "ClickEvent" with camelCase columns: eventType, establishmentId, createdAt, userId
    const { data: clicks } = await supabase
      .from('ClickEvent')
      .select('eventType, createdAt, userId')
      .eq('establishmentId', establishmentId)
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString())
      .order('createdAt', { ascending: false });

    // Get search events (how often this establishment appeared in search)
    // Table is "SearchEvent" with camelCase columns: createdAt, userId
    // Note: SearchEvent tracks searches by city/query, not per-establishment
    // We'll use PageView or ClickEvent with establishment views instead
    // For now, use the analytics_events table for search appearances
    const { data: searchEvents } = await supabase
      .from('analytics_events')
      .select('created_at, user_id')
      .eq('establishment_id', establishmentId)
      .in('event_type', ['page_view', 'search'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    // Calculate total days in range
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

    // Aggregate clicks by day
    const clicksByDay: Record<string, number> = {};
    const viewsByDay: Record<string, number> = {};

    clicks?.forEach((click: Record<string, unknown>) => {
      const day = new Date(click.createdAt as string).toISOString().split('T')[0];
      clicksByDay[day] = (clicksByDay[day] || 0) + 1;
    });

    searchEvents?.forEach((event: Record<string, unknown>) => {
      const day = new Date(event.created_at as string).toISOString().split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    // Count click types (ClickEvent uses camelCase eventType)
    const clicksByType = {
      phone: 0,
      website: 0,
      directions: 0,
    };

    clicks?.forEach((click: Record<string, unknown>) => {
      const eventType = click.eventType as string;
      if (eventType === 'click_phone' || eventType === 'PHONE') clicksByType.phone++;
      else if (eventType === 'click_website' || eventType === 'WEBSITE') clicksByType.website++;
      else if (eventType === 'click_directions' || eventType === 'DIRECTIONS') clicksByType.directions++;
    });

    // Calculate stats
    const totalClicks = clicks?.length || 0;
    const totalSearchAppearances = searchEvents?.length || 0;

    // Build daily series for chart
    const dailySeries = [];
    for (let i = daysDiff - 1; i >= 0; i--) {
      const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toISOString().split('T')[0];
      dailySeries.push({
        date: dayStr,
        views: viewsByDay[dayStr] || 0,
        clicks: clicksByDay[dayStr] || 0,
      });
    }

    // Base response (available to all tiers)
    const response: Record<string, unknown> = {
      summary: {
        totalClicks,
        totalSearchAppearances,
        avgClicksPerDay: Math.round(totalClicks / daysDiff),
        clickThroughRate: totalSearchAppearances > 0
          ? parseFloat(((totalClicks / totalSearchAppearances) * 100).toFixed(1))
          : 0,
      },
      tier,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: daysDiff,
      },
    };

    // Premium-only data: breakdowns, daily series, recent activity
    if (tier === 'premium' || dbUser.role === 'ADMIN') {
      response.clicks = clicksByType;
      response.daily = dailySeries;

      // Recent activity feed - last 50 interactions with details
      const recentActivity = [
        ...(clicks || []).map((c: Record<string, unknown>) => ({
          type: c.eventType as string,
          createdAt: c.createdAt as string,
          userId: c.userId as string | null,
        })),
        ...(searchEvents || []).map((s: Record<string, unknown>) => ({
          type: 'SEARCH_APPEARANCE',
          createdAt: s.created_at as string,
          userId: s.user_id as string | null,
        })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);

      response.recentActivity = recentActivity;

      // Unique visitors count
      const uniqueUserIds = new Set<string>();
      clicks?.forEach((c: Record<string, unknown>) => {
        if (c.userId) uniqueUserIds.add(c.userId as string);
      });
      searchEvents?.forEach((s: Record<string, unknown>) => {
        if (s.user_id) uniqueUserIds.add(s.user_id as string);
      });
      response.uniqueVisitors = uniqueUserIds.size;

      // Peak day
      let peakDay = '';
      let peakViews = 0;
      for (const [day, count] of Object.entries(viewsByDay)) {
        if (count > peakViews) {
          peakViews = count;
          peakDay = day;
        }
      }
      response.peakDay = { date: peakDay, views: peakViews };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

import { requireBusinessOrAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the business's approved claim
    const { data: claim, error: claimError } = await supabase
      .from('BusinessClaim')
      .select('establishmentId')
      .eq('userId', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get click events over last 30 days
    const { data: clicks } = await supabase
      .from('ClickEvent')
      .select('eventType, createdAt')
      .eq('establishmentId', claim.establishmentId)
      .gte('createdAt', thirtyDaysAgo.toISOString())
      .lte('createdAt', now.toISOString());

    // Get search events (how often this establishment appeared in search)
    const { data: searchEvents } = await supabase
      .from('SearchEvent')
      .select('createdAt')
      .eq('establishmentId', claim.establishmentId)
      .gte('createdAt', thirtyDaysAgo.toISOString())
      .lte('createdAt', now.toISOString());

    // Aggregate clicks by day
    const clicksByDay: Record<string, number> = {};
    const viewsByDay: Record<string, number> = {};

    clicks?.forEach((click: Record<string, unknown>) => {
      const day = new Date(click.createdAt as string).toISOString().split('T')[0];
      clicksByDay[day] = (clicksByDay[day] || 0) + 1;
    });

    searchEvents?.forEach((event: Record<string, unknown>) => {
      const day = new Date(event.createdAt as string).toISOString().split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    // Count click types
    const clicksByType = {
      phone: 0,
      website: 0,
      directions: 0,
    };

    clicks?.forEach((click: Record<string, unknown>) => {
      const eventType = click.eventType as string;
      if (eventType === 'PHONE') clicksByType.phone++;
      else if (eventType === 'WEBSITE') clicksByType.website++;
      else if (eventType === 'DIRECTIONS') clicksByType.directions++;
    });

    // Calculate stats
    const totalClicks = clicks?.length || 0;
    const totalSearchAppearances = searchEvents?.length || 0;

    // Build daily series for chart
    const dailySeries = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toISOString().split('T')[0];
      dailySeries.push({
        date: dayStr,
        views: viewsByDay[dayStr] || 0,
        clicks: clicksByDay[dayStr] || 0,
      });
    }

    return NextResponse.json({
      summary: {
        totalClicks,
        totalSearchAppearances,
        avgClicksPerDay: Math.round(totalClicks / 30),
      },
      clicks: clicksByType,
      daily: dailySeries,
      period: {
        start: thirtyDaysAgo.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

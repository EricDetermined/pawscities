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
      .from('business_claims')
      .select('establishment_id')
      .eq('user_id', dbUser.id)
      .eq('status', 'approved')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get page views over last 30 days
    const { data: views } = await supabase
      .from('analytics_events')
      .select('created_at')
      .eq('establishment_id', claim.establishment_id)
      .eq('event_type', 'page_view')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .lte('created_at', now.toISOString());

    // Get click events over last 30 days (phone, website, directions, share)
    const { data: clicks } = await supabase
      .from('analytics_events')
      .select('event_type, created_at')
      .eq('establishment_id', claim.establishment_id)
      .in('event_type', ['click_phone', 'click_website', 'click_directions', 'click_share'])
      .gte('created_at', thirtyDaysAgo.toISOString())
      .lte('created_at', now.toISOString());

    // Aggregate data by day for chart
    const viewsByDay: Record<string, number> = {};
    const clicksByDay: Record<string, number> = {};

    views?.forEach((view: any) => {
      const day = new Date(view.created_at).toISOString().split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    clicks?.forEach((click: any) => {
      const day = new Date(click.created_at).toISOString().split('T')[0];
      clicksByDay[day] = (clicksByDay[day] || 0) + 1;
    });

    // Count click types
    const clicksByType = {
      phone: 0,
      website: 0,
      directions: 0,
    };

    clicks?.forEach((click: any) => {
      if (click.event_type === 'click_phone') clicksByType.phone++;
      else if (click.event_type === 'click_website') clicksByType.website++;
      else if (click.event_type === 'click_directions') clicksByType.directions++;
    });

    // Calculate stats
    const totalViews = views?.length || 0;
    const totalClicks = clicks?.length || 0;
    const avgViewsPerDay = Math.round(totalViews / 30);

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
        totalViews,
        totalClicks,
        avgViewsPerDay,
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

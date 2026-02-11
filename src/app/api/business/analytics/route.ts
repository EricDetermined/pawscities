import { requireBusinessOrAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
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

    // Get page views over last 30 days
    const { data: views, error: viewsError } = await supabase
      .from('PageView')
      .select('createdAt')
      .eq('establishmentId', claim.establishmentId)
      .gte('createdAt', thirtyDaysAgo.toISOString())
      .lte('createdAt', now.toISOString());

    // Get click events over last 30 days
    const { data: clicks, error: clicksError } = await supabase
      .from('ClickEvent')
      .select('type, createdAt')
      .eq('establishmentId', claim.establishmentId)
      .gte('createdAt', thirtyDaysAgo.toISOString())
      .lte('createdAt', now.toISOString());

    // Aggregate data by day for chart
    const viewsByDay: Record<string, number> = {};
    const clicksByDay: Record<string, number> = {};

    views?.forEach((view: any) => {
      const day = new Date(view.createdAt).toISOString().split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    clicks?.forEach((click: any) => {
      const day = new Date(click.createdAt).toISOString().split('T')[0];
      clicksByDay[day] = (clicksByDay[day] || 0) + 1;
    });

    // Count click types
    const clicksByType = {
      phone: 0,
      website: 0,
      directions: 0,
    };

    clicks?.forEach((click: any) => {
      if (click.type === 'phone') clicksByType.phone++;
      else if (click.type === 'website') clicksByType.website++;
      else if (click.type === 'directions') clicksByType.directions++;
    });

    // Calculate stats
    const totalViews = views?.length || 0;
    const totalClicks = clicks?.length || 0;
    const avgViewsPerDay = (totalViews / 30).toFixed(0);

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
        avgViewsPerDay: parseInt(String(avgViewsPerDay)),
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

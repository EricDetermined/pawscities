import { requireBusinessOrAdmin, getEstablishmentForUser } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const result = await getEstablishmentForUser(supabase, dbUser);

    if (!result) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    const establishmentId = result.establishmentId;

    // Check subscription - export is Premium only
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('establishment_id', establishmentId)
      .eq('status', 'ACTIVE')
      .single();

    const tier = subscription?.tier || 'free';

    if (tier !== 'premium' && dbUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Analytics export is a Premium feature. Upgrade to access.' },
        { status: 403 }
      );
    }

    // Parse date range
    const searchParams = request.nextUrl.searchParams;
    const now = new Date();
    const endDate = searchParams.get('end')
      ? new Date(searchParams.get('end')! + 'T23:59:59.999Z')
      : now;
    const startDate = searchParams.get('start')
      ? new Date(searchParams.get('start')! + 'T00:00:00.000Z')
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const format = searchParams.get('format') || 'daily'; // 'daily' or 'events'

    if (format === 'events') {
      // Export raw events
      const { data: clicks } = await supabase
        .from('click_events')
        .select('event_type, created_at')
        .eq('establishment_id', establishmentId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      const { data: searchEvents } = await supabase
        .from('search_events')
        .select('created_at')
        .eq('establishment_id', establishmentId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      // Build CSV
      const rows = [
        ['Date', 'Time', 'Event Type'].join(','),
      ];

      const allEvents = [
        ...(clicks || []).map((c: Record<string, unknown>) => ({
          type: c.event_type as string,
          createdAt: c.created_at as string,
        })),
        ...(searchEvents || []).map((s: Record<string, unknown>) => ({
          type: 'SEARCH_APPEARANCE',
          createdAt: s.created_at as string,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      for (const event of allEvents) {
        const dt = new Date(event.createdAt);
        rows.push([
          dt.toISOString().split('T')[0],
          dt.toISOString().split('T')[1].split('.')[0],
          event.type,
        ].join(','));
      }

      const csv = rows.join('\n');
      const filename = `analytics-events-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: daily summary export
    const { data: clicks } = await supabase
      .from('click_events')
      .select('event_type, created_at')
      .eq('establishment_id', establishmentId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const { data: searchEvents } = await supabase
      .from('search_events')
      .select('created_at')
      .eq('establishment_id', establishmentId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Aggregate by day
    const dayStats: Record<string, { views: number; clicks: number; phone: number; website: number; directions: number }> = {};

    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    for (let i = daysDiff - 1; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = d.toISOString().split('T')[0];
      dayStats[dayStr] = { views: 0, clicks: 0, phone: 0, website: 0, directions: 0 };
    }

    clicks?.forEach((c: Record<string, unknown>) => {
      const day = new Date(c.created_at as string).toISOString().split('T')[0];
      if (dayStats[day]) {
        dayStats[day].clicks++;
        const eventType = c.event_type as string;
        if (eventType === 'PHONE') dayStats[day].phone++;
        else if (eventType === 'WEBSITE') dayStats[day].website++;
        else if (eventType === 'DIRECTIONS') dayStats[day].directions++;
      }
    });

    searchEvents?.forEach((s: Record<string, unknown>) => {
      const day = new Date(s.created_at as string).toISOString().split('T')[0];
      if (dayStats[day]) dayStats[day].views++;
    });

    const rows = [
      ['Date', 'Views', 'Total Clicks', 'Phone Clicks', 'Website Clicks', 'Direction Clicks', 'CTR (%)'].join(','),
    ];

    for (const [day, stats] of Object.entries(dayStats).sort()) {
      const ctr = stats.views > 0 ? ((stats.clicks / stats.views) * 100).toFixed(1) : '0.0';
      rows.push([day, stats.views, stats.clicks, stats.phone, stats.website, stats.directions, ctr].join(','));
    }

    const csv = rows.join('\n');
    const filename = `analytics-daily-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    return NextResponse.json({ error: 'Failed to export analytics' }, { status: 500 });
  }
}

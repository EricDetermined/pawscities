import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Seeds sample analytics_events data for testing dashboards.
 * Admin-only endpoint. Call POST to generate ~800 events across 30 days.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;

    // Check if analytics data already exists
    const { count: existingCount } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true });

    if ((existingCount || 0) > 50) {
      return NextResponse.json({
        message: `Analytics data already exists (${existingCount} events). Skipping seed.`,
        seeded: false,
      });
    }

    // Get all establishments
    const { data: establishments, error: estError } = await supabase
      .from('establishments')
      .select('id, city_id, name')
      .eq('status', 'ACTIVE')
      .limit(265);

    if (estError || !establishments?.length) {
      return NextResponse.json(
        { error: 'No establishments found to seed analytics' },
        { status: 400 }
      );
    }

    // Get all city IDs
    const { data: cities } = await supabase
      .from('cities')
      .select('id, slug');

    const cityIds = cities?.map((c) => c.id) || [];

    // Event types with realistic distribution weights
    const eventTypes = [
      { type: 'page_view', weight: 40 },
      { type: 'search', weight: 15 },
      { type: 'click_phone', weight: 8 },
      { type: 'click_website', weight: 10 },
      { type: 'click_directions', weight: 8 },
      { type: 'click_share', weight: 4 },
      { type: 'favorite_add', weight: 5 },
      { type: 'favorite_remove', weight: 2 },
      { type: 'review_submit', weight: 3 },
      { type: 'check_in', weight: 3 },
      { type: 'photo_view', weight: 2 },
    ];

    const totalWeight = eventTypes.reduce((s, e) => s + e.weight, 0);

    // Search queries for search events
    const searchQueries = [
      'dog friendly restaurants',
      'pet hotel near me',
      'dog park',
      'vet clinic emergency',
      'dog grooming',
      'cafe with dogs allowed',
      'best dog parks',
      'pet friendly hotels',
      'dog walker',
      'puppy daycare',
      'off leash dog area',
      'pet store organic food',
      'dog beach',
      'veterinarian open sunday',
      'dog friendly brunch',
    ];

    // Page paths for page_view events
    const pagePaths = [
      '/',
      '/explore',
      '/cities/geneva',
      '/cities/paris',
      '/cities/london',
      '/cities/losangeles',
      '/cities/newyork',
      '/cities/barcelona',
      '/cities/sydney',
      '/cities/tokyo',
    ];

    // Generate events for last 30 days
    const now = Date.now();
    const events: any[] = [];

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      // More events on weekdays, fewer on weekends
      const dayDate = new Date(now - dayOffset * 24 * 60 * 60 * 1000);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const baseEventsPerDay = isWeekend ? 15 : 25;
      const eventsToday = baseEventsPerDay + Math.floor(Math.random() * 10);

      for (let i = 0; i < eventsToday; i++) {
        // Pick event type based on weights
        let rand = Math.random() * totalWeight;
        let eventType = 'page_view';
        for (const et of eventTypes) {
          rand -= et.weight;
          if (rand <= 0) {
            eventType = et.type;
            break;
          }
        }

        // Random establishment
        const est = establishments[Math.floor(Math.random() * establishments.length)];

        // Random hour of day (skew toward daytime)
        const hour = Math.min(23, Math.max(6, Math.floor(8 + Math.random() * 14)));
        const minute = Math.floor(Math.random() * 60);
        const eventTime = new Date(dayDate);
        eventTime.setHours(hour, minute, Math.floor(Math.random() * 60));

        const event: any = {
          event_type: eventType,
          establishment_id: est.id,
          city_id: est.city_id,
          created_at: eventTime.toISOString(),
          session_id: `sess_${dayOffset}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        };

        // Add search_query for search events
        if (eventType === 'search') {
          event.search_query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
          event.establishment_id = null; // search events don't have establishment
        }

        // Add page_path for page_view events
        if (eventType === 'page_view') {
          // 60% chance of being an establishment page view, 40% general page
          if (Math.random() < 0.6) {
            event.page_path = `/cities/${cities?.find((c) => c.id === est.city_id)?.slug || 'unknown'}/${est.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          } else {
            event.page_path = pagePaths[Math.floor(Math.random() * pagePaths.length)];
            event.establishment_id = null;
          }
        }

        events.push(event);
      }
    }

    // Insert in batches of 100
    let inserted = 0;
    for (let i = 0; i < events.length; i += 100) {
      const batch = events.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from('analytics_events')
        .insert(batch);

      if (insertError) {
        console.error(`Batch insert error at ${i}:`, insertError.message);
        // Continue with next batch
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      message: `Successfully seeded ${inserted} analytics events across 30 days`,
      seeded: true,
      totalEvents: inserted,
      establishments: establishments.length,
      cities: cityIds.length,
    });
  } catch (error) {
    console.error('Seed analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to seed analytics data' },
      { status: 500 }
    );
  }
}

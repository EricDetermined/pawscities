import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      eventType,
      userId,
      establishmentId,
      cityId,
      queryString,
      metadata,
    } = body;

    // Validate required field
    if (!eventType) {
      return NextResponse.json(
        { error: 'Missing required field: eventType' },
        { status: 400 }
      );
    }

    // Validate eventType
    const validEventTypes = [
      'page_view',
      'establishment_view',
      'search',
      'click_phone',
      'click_website',
      'click_directions',
      'review_submitted',
      'claim_submitted',
      'favorite_added',
      'favorite_removed',
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Track click-type events in the ClickEvent table (camelCase columns)
    const clickTypes = ['click_phone', 'click_website', 'click_directions'];
    if (clickTypes.includes(eventType) && establishmentId) {
      const { error: clickError } = await supabase
        .from('ClickEvent')
        .insert([{
          eventType,
          establishmentId,
          userId: userId || null,
          metadata: metadata || null,
        }]);

      if (clickError) {
        console.error('ClickEvent insert error:', clickError.message);
      }
    }

    // Also insert into analytics_events for broader tracking (snake_case columns)
    const { data: event, error: createError } = await supabase
      .from('analytics_events')
      .insert([{
        event_type: eventType,
        user_id: userId || null,
        establishment_id: establishmentId || null,
        city_id: cityId || null,
        search_query: queryString || null,
      }])
      .select();

    if (createError) {
      console.error('analytics_events insert error:', createError.message);
    }

    return NextResponse.json({
      success: true,
      eventId: event?.[0]?.id,
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Return success even on error to prevent client-side failures
    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  }
}

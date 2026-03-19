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

    // Create analytics event
    const { data: event, error: createError } = await supabase
      .from('click_events')
      .insert([
        {
          event_type: eventType,
          user_id: userId || null,
          establishment_id: establishmentId || null,
          city_id: cityId || null,
          query_string: queryString || null,
          metadata: metadata || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (createError) {
      throw new Error(`Failed to log event: ${createError.message}`);
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

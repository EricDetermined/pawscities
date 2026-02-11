import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      event_type,
      user_id,
      establishment_id,
      city_id,
      query_string,
      metadata,
    } = body;

    // Validate required field
    if (!event_type) {
      return NextResponse.json(
        { error: 'Missing required field: event_type' },
        { status: 400 }
      );
    }

    // Validate event_type
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

    if (!validEventTypes.includes(event_type)) {
      return NextResponse.json(
        { error: `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create analytics event
    const { data: event, error: createError } = await supabase
      .from('analytics_events')
      .insert([
        {
          event_type,
          user_id: user_id || null,
          establishment_id: establishment_id || null,
          city_id: city_id || null,
          query_string: query_string || null,
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
      event_id: event?.[0]?.id,
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

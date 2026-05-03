import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { PawEvent } from '@/types';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/events
 *
 * Public endpoint: returns upcoming approved events.
 * Always filters out past events (start_date >= today).
 *
 * Query params:
 *   city     - filter by city slug (e.g. "losangeles")
 *   tag      - filter by tag
 *   featured - "true" to only show featured events
 *   limit    - max results (default 20, max 100)
 *   page     - pagination (default 1)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;

    const citySlug = searchParams.get('city');
    const tag = searchParams.get('tag');
    const featured = searchParams.get('featured') === 'true';
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const offset = (page - 1) * limit;

    // Today's date in UTC — the core filter that prevents past events
    const today = new Date().toISOString().split('T')[0];

    // Build query: only approved events with start_date >= today
    let query = supabase
      .from('events')
      .select(`
        *,
        cities!inner(slug, name)
      `, { count: 'exact' })
      .eq('status', 'APPROVED')
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .range(offset, offset + limit - 1);

    // City filter
    if (citySlug) {
      query = query.eq('cities.slug', citySlug);
    }

    // Tag filter
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // Featured filter
    if (featured) {
      query = query.eq('is_featured', true);
    }

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Events fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Map database rows to PawEvent type
    const mapped: PawEvent[] = (events || []).map((row: Record<string, unknown>) => {
      const city = row.cities as { slug: string; name: string } | null;
      return {
        id: row.id as string,
        slug: row.slug as string,
        citySlug: city?.slug || '',
        cityName: city?.name || '',
        name: row.name as string,
        description: row.description as string | null,
        venueName: row.venue_name as string | null,
        venueAddress: row.venue_address as string | null,
        externalUrl: row.external_url as string | null,
        startDate: row.start_date as string,
        endDate: row.end_date as string | null,
        startTime: row.start_time as string | null,
        endTime: row.end_time as string | null,
        timezone: row.timezone as string | null,
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        imageUrl: row.image_url as string | null,
        tags: (row.tags as string[]) || [],
        sourceHandle: row.source_handle as string | null,
        sourcePostUrl: row.source_post_url as string | null,
        discoveryScore: (row.discovery_score as number) || 0,
        mentionedHandles: (row.mentioned_handles as string[]) || [],
        status: row.status as PawEvent['status'],
        source: row.source as PawEvent['source'],
        isFeatured: row.is_featured as boolean,
        isFree: row.is_free as boolean,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    });

    return NextResponse.json({
      events: mapped,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Events GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 *
 * Public endpoint: submit a new event for admin review.
 * No authentication required — anyone can suggest an event.
 * Event is created with status PENDING.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    // Validate required fields
    const { name, startDate, citySlug, submitterName, submitterEmail } = body;

    if (!name || !startDate || !citySlug || !submitterName || !submitterEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: name, startDate, citySlug, submitterName, submitterEmail' },
        { status: 400 }
      );
    }

    // Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (startDate < today) {
      return NextResponse.json(
        { error: 'Event start date cannot be in the past' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(submitterEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Look up city ID from slug
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', citySlug)
      .single();

    if (cityError || !city) {
      return NextResponse.json(
        { error: `City "${citySlug}" not found` },
        { status: 400 }
      );
    }

    // Check for optional authenticated user
    let submittedBy = null;
    try {
      const userSupabase = await createClient();
      const { data: { user } } = await userSupabase.auth.getUser();
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id')
          .eq('supabase_id', user.id)
          .single();
        if (dbUser) {
          submittedBy = dbUser.id;
        }
      }
    } catch {
      // Not authenticated, that's fine
    }

    // Generate slug from name + date
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 200)
      + '-' + startDate;

    // Insert the event
    const { data: event, error: insertError } = await supabase
      .from('events')
      .insert({
        slug,
        city_id: city.id,
        name: name.substring(0, 500),
        description: body.description?.substring(0, 5000) || null,
        venue_name: body.venueName?.substring(0, 255) || null,
        venue_address: body.venueAddress || null,
        external_url: body.externalUrl || null,
        start_date: startDate,
        end_date: body.endDate || null,
        start_time: body.startTime || null,
        end_time: body.endTime || null,
        timezone: body.timezone || null,
        image_url: body.imageUrl || null,
        tags: body.tags || [],
        status: 'PENDING',
        source: 'user_submission',
        submitted_by: submittedBy,
        submitter_name: submitterName.substring(0, 255),
        submitter_email: submitterEmail.substring(0, 255),
        is_free: body.isFree || false,
      })
      .select('id, slug')
      .single();

    if (insertError) {
      // Handle duplicate slug
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'An event with this name and date already exists for this city' },
          { status: 409 }
        );
      }
      console.error('Event insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit event' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: event?.id,
      message: 'Event submitted successfully! It will appear on the calendar after admin review.',
    }, { status: 201 });
  } catch (error) {
    console.error('Events POST error:', error);
    return NextResponse.json(
      { error: 'Failed to submit event' },
      { status: 500 }
    );
  }
}

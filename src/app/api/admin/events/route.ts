export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/admin';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/admin/events
 *
 * Admin endpoint: list events with status filtering.
 * Unlike the public endpoint, this shows ALL events including past and pending.
 *
 * Query params:
 *   status  - PENDING, APPROVED, REJECTED, CANCELLED, or "all" (default PENDING)
 *   city    - filter by city slug
 *   page    - pagination (default 1)
 *   limit   - max results (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get('status') || 'PENDING';
    const citySlug = searchParams.get('city');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
    const offset = (page - 1) * limit;

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

    // Count query
    let countQuery = supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    if (status !== 'all' && validStatuses.includes(status.toUpperCase())) {
      countQuery = countQuery.eq('status', status.toUpperCase());
    }

    const { count: totalCount } = await countQuery;

    // Data query
    // All tabs: chronological by start_date ascending (soonest events on top)
    // REJECTED: most recently reviewed first (review history)
    const upperStatus = status.toUpperCase();
    const sortField = upperStatus === 'REJECTED' ? 'reviewed_at' : 'start_date';
    const sortAsc = upperStatus !== 'REJECTED';

    let query = supabase
      .from('events')
      .select(`
        *,
        cities(slug, name)
      `)
      .order(sortField, { ascending: sortAsc, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all' && validStatuses.includes(status.toUpperCase())) {
      query = query.eq('status', status.toUpperCase());
    }

    if (citySlug) {
      // Need to look up city ID first
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', citySlug)
        .single();

      if (city) {
        query = query.eq('city_id', city.id);
      }
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Admin events fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: events || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin events GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/events
 *
 * Admin endpoint: create an event directly (bypasses approval).
 * Used for manually adding events or bulk-importing from discovery agent.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    // Support both single event and batch import
    const events = Array.isArray(body) ? body : [body];
    const results = [];

    for (const eventData of events) {
      const { name, startDate, citySlug } = eventData;

      if (!name || !startDate || !citySlug) {
        results.push({ error: `Missing required fields for "${name || 'unnamed'}"` });
        continue;
      }

      // Look up city ID
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', citySlug)
        .single();

      if (!city) {
        results.push({ error: `City "${citySlug}" not found` });
        continue;
      }

      const slug = (name as string)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 200)
        + '-' + startDate;

      const { data: event, error: insertError } = await supabase
        .from('events')
        .insert({
          slug,
          city_id: city.id,
          name,
          description: eventData.description || null,
          venue_name: eventData.venueName || null,
          venue_address: eventData.venueAddress || null,
          external_url: eventData.externalUrl || null,
          start_date: startDate,
          end_date: eventData.endDate || null,
          start_time: eventData.startTime || null,
          end_time: eventData.endTime || null,
          timezone: eventData.timezone || null,
          image_url: eventData.imageUrl || null,
          tags: eventData.tags || [],
          source_handle: eventData.sourceHandle || null,
          source_post_url: eventData.sourcePostUrl || null,
          discovery_score: eventData.discoveryScore || 0,
          mentioned_handles: eventData.mentionedHandles || [],
          status: eventData.status || 'APPROVED', // Admin-created events default to approved
          source: eventData.source || 'admin',
          is_featured: eventData.isFeatured || false,
          is_free: eventData.isFree || false,
        })
        .select('id, slug, name')
        .single();

      if (insertError) {
        results.push({ error: `Failed to create "${name}": ${insertError.message}` });
      } else {
        results.push({ success: true, id: event?.id, slug: event?.slug, name: event?.name });
      }
    }

    const successCount = results.filter(r => 'success' in r).length;
    const errorCount = results.filter(r => 'error' in r).length;

    return NextResponse.json({
      created: successCount,
      errors: errorCount,
      results,
    }, { status: successCount > 0 ? 201 : 400 });
  } catch (error) {
    console.error('Admin events POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create events' },
      { status: 500 }
    );
  }
}

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
 * PATCH /api/admin/ingest/[id]
 *
 * Actions on individual ingest_queue items:
 *   - dismiss:      Mark as dismissed (removes from review queue)
 *   - reprocess:    Reset to pending so the process-ingest cron picks it up again
 *   - create_event: Create an event directly from this ingest item, then mark processed
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = getSupabaseAdmin();
    const itemId = params.id;
    const body = await request.json();
    const { action } = body;

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from('ingest_queue')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Ingest item not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'dismiss': {
        const reason = body.reason || 'Manually dismissed by admin';
        const { error: updateError } = await supabase
          .from('ingest_queue')
          .update({
            status: 'dismissed',
            error_message: reason,
            processed_at: new Date().toISOString(),
          })
          .eq('id', itemId);

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({
          success: true,
          id: itemId,
          status: 'dismissed',
          message: `Item dismissed: ${item.subject || 'untitled'}`,
        });
      }

      case 'reprocess': {
        const { error: updateError } = await supabase
          .from('ingest_queue')
          .update({
            status: 'pending',
            error_message: null,
            processed_at: null,
          })
          .eq('id', itemId);

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({
          success: true,
          id: itemId,
          status: 'pending',
          message: `Item queued for reprocessing: ${item.subject || 'untitled'}`,
        });
      }

      case 'create_event': {
        // Create an event directly from the ingest item
        const { name, citySlug, startDate, endDate, description, venueName, venueAddress, externalUrl, tags } = body;

        if (!name || !startDate || !citySlug) {
          return NextResponse.json(
            { error: 'Missing required fields: name, startDate, citySlug' },
            { status: 400 }
          );
        }

        // Look up city
        const { data: city } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', citySlug)
          .single();

        if (!city) {
          return NextResponse.json(
            { error: `City "${citySlug}" not found` },
            { status: 400 }
          );
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
            description: description || item.raw_text?.slice(0, 500) || null,
            venue_name: venueName || null,
            venue_address: venueAddress || null,
            external_url: externalUrl || item.url || null,
            start_date: startDate,
            end_date: endDate || null,
            tags: tags || [],
            source_handle: item.source || null,
            source_post_url: item.url || null,
            status: 'APPROVED',
            source: 'admin',
          })
          .select('id, slug, name')
          .single();

        if (insertError) {
          return NextResponse.json(
            { error: `Failed to create event: ${insertError.message}` },
            { status: 500 }
          );
        }

        // Mark ingest item as processed
        await supabase
          .from('ingest_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', itemId);

        // ── URGENT FAST-TRACK (manual path) ────────────────────────────
        // Same rule as process-ingest: an event within 7 days can't wait
        // for the daily review cycle. The admin just reviewed and approved
        // the details by hand (venue/date are form-validated), so generate
        // the creative NOW and auto-approve it — the next event posting
        // slot (09:00/17:00 UTC) will publish it same-day.
        let fastTracked = false;
        const daysUntilEvent = Math.ceil(
          (new Date(startDate + 'T00:00:00Z').getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
        if (event?.id && daysUntilEvent >= 0 && daysUntilEvent <= 7) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
              || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://pawcities.com');
            const creativeRes = await fetch(`${baseUrl}/api/admin/creatives`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'generate_event', eventId: event.id }),
              signal: AbortSignal.timeout(60000),
            });
            const creativeData = await creativeRes.json().catch(() => ({}));
            if (creativeData.success) {
              await supabase
                .from('creative_queue')
                .update({ status: 'approved' })
                .eq('event_id', event.id)
                .eq('status', 'pending_review');
              fastTracked = true;
            }
          } catch (ftErr) {
            console.error(`[ADMIN-INGEST] Fast-track error for "${name}":`, ftErr);
          }
        }

        return NextResponse.json({
          success: true,
          id: itemId,
          status: 'processed',
          event: { id: event?.id, slug: event?.slug, name: event?.name },
          fastTracked,
          message: fastTracked
            ? `Event "${name}" created — happening in ${daysUntilEvent}d, creative generated & approved; posts in the next event slot (9am/5pm UTC)`
            : `Event "${name}" created from ingest item`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: dismiss, reprocess, or create_event' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin ingest PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update ingest item' },
      { status: 500 }
    );
  }
}

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
 * GET /api/admin/events/[id]
 *
 * Admin: get full event details including review info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = getSupabaseAdmin();
    const eventId = params.id;

    const { data: event, error } = await supabase
      .from('events')
      .select(`
        *,
        cities(slug, name, country)
      `)
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Admin event GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/events/[id]
 *
 * Admin: approve, reject, cancel, edit, or feature an event.
 *
 * Body:
 *   action: "approve" | "reject" | "cancel" | "feature" | "unfeature" | "edit"
 *   reviewNotes?: string  (for approve/reject)
 *   ...fields to update (for edit action)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = getSupabaseAdmin();
    const eventId = params.id;
    const body = await request.json();
    const { action, reviewNotes } = body;

    // Get the event first
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, status, name, submitter_email, submitter_name')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'approve': {
        if (event.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'Only pending events can be approved' },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabase
          .from('events')
          .update({
            status: 'APPROVED',
            reviewed_by: authResult.dbUser?.id || null,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || null,
          })
          .eq('id', eventId);

        if (updateError) throw new Error(updateError.message);

        // TODO: Send approval email to submitter if submitter_email exists

        return NextResponse.json({
          id: eventId,
          status: 'APPROVED',
          message: `Event "${event.name}" approved`,
        });
      }

      case 'reject': {
        if (event.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'Only pending events can be rejected' },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabase
          .from('events')
          .update({
            status: 'REJECTED',
            reviewed_by: authResult.dbUser?.id || null,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || null,
          })
          .eq('id', eventId);

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({
          id: eventId,
          status: 'REJECTED',
          message: `Event "${event.name}" rejected`,
        });
      }

      case 'cancel': {
        const { error: updateError } = await supabase
          .from('events')
          .update({
            status: 'CANCELLED',
            review_notes: reviewNotes || null,
          })
          .eq('id', eventId);

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({
          id: eventId,
          status: 'CANCELLED',
          message: `Event "${event.name}" cancelled`,
        });
      }

      case 'feature': {
        const { error: updateError } = await supabase
          .from('events')
          .update({ is_featured: true })
          .eq('id', eventId);

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({
          id: eventId,
          isFeatured: true,
          message: `Event "${event.name}" marked as featured`,
        });
      }

      case 'unfeature': {
        const { error: updateError } = await supabase
          .from('events')
          .update({ is_featured: false })
          .eq('id', eventId);

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({
          id: eventId,
          isFeatured: false,
          message: `Event "${event.name}" removed from featured`,
        });
      }

      case 'edit': {
        // Allow editing specific fields
        const allowedFields: Record<string, string> = {
          name: 'name',
          description: 'description',
          venueName: 'venue_name',
          venueAddress: 'venue_address',
          externalUrl: 'external_url',
          startDate: 'start_date',
          endDate: 'end_date',
          startTime: 'start_time',
          endTime: 'end_time',
          imageUrl: 'image_url',
          tags: 'tags',
          isFree: 'is_free',
        };

        const updates: Record<string, unknown> = {};
        for (const [jsKey, dbKey] of Object.entries(allowedFields)) {
          if (body[jsKey] !== undefined) {
            updates[dbKey] = body[jsKey];
          }
        }

        if (Object.keys(updates).length === 0) {
          return NextResponse.json(
            { error: 'No valid fields to update' },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabase
          .from('events')
          .update(updates)
          .eq('id', eventId);

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({
          id: eventId,
          message: `Event "${event.name}" updated`,
          updatedFields: Object.keys(updates),
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: approve, reject, cancel, feature, unfeature, or edit' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin event PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[id]
 *
 * Admin: permanently delete an event.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = getSupabaseAdmin();
    const eventId = params.id;

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('Event delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Admin event DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

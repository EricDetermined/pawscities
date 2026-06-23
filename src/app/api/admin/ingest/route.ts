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
 * PATCH /api/admin/ingest
 *
 * Bulk actions on ingest_queue items:
 *   - dismiss_all:       Dismiss all items with status 'needs_review'
 *   - dismiss_processed:  Dismiss all 'processed' items older than 7 days (cleanup)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'dismiss_all': {
        const { data, error: updateError } = await supabase
          .from('ingest_queue')
          .update({
            status: 'dismissed',
            error_message: 'Bulk dismissed by admin',
            processed_at: new Date().toISOString(),
          })
          .eq('status', 'needs_review')
          .select('id');

        if (updateError) throw new Error(updateError.message);

        const count = data?.length || 0;
        return NextResponse.json({
          success: true,
          action: 'dismiss_all',
          count,
          message: `Dismissed ${count} items that needed review`,
        });
      }

      case 'dismiss_processed': {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data, error: updateError } = await supabase
          .from('ingest_queue')
          .update({
            status: 'dismissed',
            error_message: 'Cleaned up: processed item older than 7 days',
          })
          .eq('status', 'processed')
          .lt('created_at', sevenDaysAgo)
          .select('id');

        if (updateError) throw new Error(updateError.message);

        const count = data?.length || 0;
        return NextResponse.json({
          success: true,
          action: 'dismiss_processed',
          count,
          message: `Cleaned up ${count} old processed items`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: dismiss_all or dismiss_processed' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin ingest bulk PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk ingest action' },
      { status: 500 }
    );
  }
}

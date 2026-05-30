export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';

/**
 * Run database migrations via API
 * Uses Supabase Management API to execute SQL
 * GET /api/admin/run-migration?secret=CRON_SECRET&run=013
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const run = request.nextUrl.searchParams.get('run');

  if (run === '013') {
    // Migration 013: Update ingest_queue constraints for event discovery pipeline
    return NextResponse.json({
      migration: '013_ingest_queue_constraints',
      instructions: 'Run this SQL in your Supabase Dashboard > SQL Editor:',
      sql: [
        "ALTER TABLE ingest_queue DROP CONSTRAINT IF EXISTS ingest_queue_source_check;",
        "ALTER TABLE ingest_queue ADD CONSTRAINT ingest_queue_source_check CHECK (source IN ('share_sheet', 'email', 'manual', 'agent', 'event_discovery', 'google_events'));",
        "",
        "ALTER TABLE ingest_queue DROP CONSTRAINT IF EXISTS ingest_queue_classification_check;",
        "ALTER TABLE ingest_queue ADD CONSTRAINT ingest_queue_classification_check CHECK (classification IN ('event', 'business_event', 'repost', 'engagement', 'influencer', 'partnership', 'other', NULL));",
        "",
        "ALTER TABLE ingest_queue DROP CONSTRAINT IF EXISTS ingest_queue_status_check;",
        "ALTER TABLE ingest_queue ADD CONSTRAINT ingest_queue_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dismissed', 'needs_review', 'processed', 'error'));",
      ].join('\n'),
    });
  }

  return NextResponse.json({
    available: ['013'],
    usage: 'Add ?run=013 to see the SQL for a specific migration',
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Agent heartbeat (2026-09-24).
 *
 * WHY: scheduled tasks (business-claim-dms, engagement, discovery, enrichment,
 * translation) run on separate surfaces and previously left no shared trace of
 * "I ran, here's how it went". When one silently stalled or got disabled, the
 * only signal was Eric noticing downstream. This endpoint gives every agent a
 * single place to stamp a heartbeat, so the Marketing dashboard and the
 * fleet-watchdog can see at a glance which agents are alive, when they last ran,
 * and whether they reported trouble.
 *
 * Stored in app_config as key `heartbeat:<agent>`, value = JSON
 * { status, detail, at } (last write wins). Simple, no new table/migration.
 *
 * POST { secret, agent, status?, detail? }  → record a heartbeat
 * GET  (admin only)                          → list all heartbeats
 */

const PREFIX = 'heartbeat:';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  let body: { secret?: string; agent?: string; status?: string; detail?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  if (body.secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const agent = (body.agent || '').trim().slice(0, 80);
  if (!agent) return NextResponse.json({ error: 'agent required' }, { status: 400 });

  const value = JSON.stringify({
    status: (body.status || 'ok').slice(0, 40),
    detail: (body.detail || '').slice(0, 500),
    at: new Date().toISOString(),
  });

  const { error } = await admin().from('app_config').upsert({
    key: PREFIX + agent,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: 'store_failed', detail: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const { data, error } = await admin()
    .from('app_config').select('key,value,updated_at').like('key', PREFIX + '%');
  if (error) return NextResponse.json({ error: 'read_failed', detail: error.message }, { status: 500 });

  const heartbeats = (data || []).map((row) => {
    let parsed: { status?: string; detail?: string; at?: string } = {};
    try { parsed = JSON.parse(String(row.value || '{}')); } catch { /* ignore */ }
    return {
      agent: String(row.key).slice(PREFIX.length),
      status: parsed.status || 'unknown',
      detail: parsed.detail || '',
      at: parsed.at || row.updated_at || null,
    };
  }).sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  return NextResponse.json({ heartbeats });
}

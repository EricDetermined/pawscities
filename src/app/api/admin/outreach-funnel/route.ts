export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { requireAdmin } from '@/lib/admin';
import { computeOutreachFunnel } from '@/lib/outreach-funnel';

/**
 * Outreach funnel accounting (2026-09-25).
 *
 * GET /api/admin/outreach-funnel
 *   Auth: CRON_SECRET (Bearer or ?secret=) for agents, or an admin session for
 *   the command center. Read-only.
 *
 * Returns the full per-channel funnel plus the `attention` list of stalls.
 * Agents curl this instead of counting rows themselves, so the dashboard, the
 * digest email and the daily agent reports can never quote different numbers.
 */

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
  }

  const sb = admin();
  if (!sb) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 500 });

  let heartbeats: Array<{ agent: string; status: string; at: string | null }> = [];
  try {
    const { data } = await sb.from('app_config').select('key,value,updated_at').like('key', 'heartbeat:%');
    heartbeats = (data || []).map((row: { key: string; value: string; updated_at: string }) => {
      let p: any = {};
      try { p = JSON.parse(String(row.value || '{}')); } catch { /* malformed heartbeat still counts as reported */ }
      return { agent: String(row.key).slice('heartbeat:'.length), status: p.status || 'unknown', at: p.at || row.updated_at || null };
    });
  } catch (e: any) {
    console.error('[outreach-funnel] heartbeats', e?.message);
  }

  const funnel = await computeOutreachFunnel(sb, heartbeats);
  const worst = funnel.attention[0]?.severity;

  return NextResponse.json({
    ...funnel,
    status: worst === 'critical' ? 'critical' : worst === 'warn' ? 'warning' : 'healthy',
  });
}

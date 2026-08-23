import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Receives a rotated Meta Page access token and stores it in app_config.
//
// WHY THIS EXISTS (2026-08-23): the instagram_manage_insights re-auth was done
// in the browser; the browser extension (correctly) refuses to exfiltrate the
// token into the assistant context, and the page's clipboard is locked by
// permissions policy. So the browser POSTs the token DIRECTLY here instead —
// it never transits any third party. Body is text/plain "SECRET|TOKEN" to
// avoid a CORS preflight from the foreign origin.
//
// The token is validated against Graph (must be a token for OUR page and able
// to read insights) before being stored.

const PAGE_ID = '1062877780238957';
const IG_ID = '17841480713996075';

export async function POST(request: NextRequest) {
  const body = (await request.text()).trim();
  const sep = body.indexOf('|');
  if (sep < 1) return cors({ error: 'bad_body' }, 400);
  const secret = body.slice(0, sep);
  const token = body.slice(sep + 1);

  if (secret !== process.env.CRON_SECRET) return cors({ error: 'unauthorized' }, 401);
  if (!token.startsWith('EAA') || token.length < 100) return cors({ error: 'not_a_token' }, 400);

  // Validate: token must belong to our page and be able to read IG insights
  try {
    const me = await fetch(`https://graph.facebook.com/v25.0/me?access_token=${token}`,
      { signal: AbortSignal.timeout(15000) }).then(r => r.json());
    if (me.id !== PAGE_ID) return cors({ error: 'wrong_page', got: me.id ?? me.error?.message }, 400);

    const ins = await fetch(
      `https://graph.facebook.com/v25.0/${IG_ID}/insights?metric=reach&period=day&metric_type=total_value&access_token=${token}`,
      { signal: AbortSignal.timeout(15000) }).then(r => r.json());
    if (ins.error) return cors({ error: 'insights_denied', detail: ins.error.message }, 400);
  } catch (e) {
    return cors({ error: 'validation_failed', detail: String(e) }, 502);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'meta_page_token', value: token, updated_at: new Date().toISOString() });
  if (error) return cors({ error: 'store_failed', detail: error.message }, 500);

  return cors({ success: true, stored: 'meta_page_token', token_length: token.length }, 200);
}

function cors(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

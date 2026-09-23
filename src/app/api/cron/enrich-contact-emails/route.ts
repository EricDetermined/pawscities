import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Contact-email enrichment (2026-09-23).
 *
 * Directory-wide "claim your establishment" outreach is email-first, but 0 of
 * our ~417 non-park listings had a contact email — only websites (315). This
 * cron visits each listing's website (server-side, from our own infra — paced),
 * extracts a business contact email, and stores it on establishments.email so
 * the claim campaign can send by email.
 *
 * Paced with an app_config cursor ('email_enrich_cursor' = last created_at
 * processed) so each run takes the next BATCH of null-email listings and the
 * whole directory is covered over several days without hammering any site.
 */

const BATCH = 25;
const CURSOR_KEY = 'email_enrich_cursor';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

// Reject junk / non-contact addresses commonly found in page source.
const BAD = /(\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|@\dx|@2x|@sentry|wixpress|squarespace|godaddy|your-email|@example\.|@domain\.|@yourdomain|@email\.|@test\.|@sentry\.|@wix\.|noreply@|no-reply@|donotreply@|sentry|example@|mail@domain|user@|name@|firstname|lastname|email@example)/i;
const PREFERRED = /^(contact|info|hello|hi|bonjour|hola|reservations|booking|reception)@/i;

function extractEmail(html: string, domain: string): string | null {
  const found = new Set<string>();
  // mailto: links first (most reliable)
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(m[1].toLowerCase());
  // then any email-looking token
  for (const m of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) found.add(m[0].toLowerCase());
  const cands = [...found].filter(e => e.length < 60 && !BAD.test(e));
  if (!cands.length) return null;
  const host = domain.replace(/^www\./, '');
  // 1) preferred prefix on the site's own domain, 2) any on-domain, 3) preferred anywhere, 4) first
  return cands.find(e => PREFERRED.test(e) && e.endsWith('@' + host))
      || cands.find(e => e.endsWith('@' + host))
      || cands.find(e => PREFERRED.test(e))
      || cands[0];
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PawCitiesBot/1.0; +https://pawcities.com)' },
      redirect: 'follow',
    });
    if (!res.ok) return '';
    return (await res.text()).slice(0, 400000);
  } catch { return ''; }
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = admin();

  // read cursor
  const { data: cfg } = await sb.from('app_config').select('value').eq('key', CURSOR_KEY).maybeSingle();
  const cursor = cfg?.value || '';

  let q = sb.from('establishments')
    .select('id,name,website,created_at')
    .not('website', 'is', null).is('email', null)
    .order('created_at', { ascending: true }).limit(BATCH);
  if (cursor) q = q.gt('created_at', cursor);
  let { data: rows } = await q;

  // end of cycle → reset cursor and stop for this run
  if (!rows || rows.length === 0) {
    await sb.from('app_config').upsert({ key: CURSOR_KEY, value: '', updated_at: new Date().toISOString() });
    return NextResponse.json({ status: 'cycle_complete', reset: true });
  }

  let found = 0, attempted = 0;
  const results: Array<{ id: string; email: string }> = [];
  for (const e of rows) {
    attempted++;
    let site = String(e.website).trim();
    if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
    let domain = '';
    try { domain = new URL(site).hostname; } catch { continue; }

    let email = extractEmail(await fetchText(site), domain);
    if (!email) email = extractEmail(await fetchText(site.replace(/\/+$/, '') + '/contact'), domain);
    if (email) {
      await sb.from('establishments').update({ email, updated_at: new Date().toISOString() }).eq('id', e.id);
      found++; results.push({ id: e.id, email });
    }
  }

  const last = rows[rows.length - 1].created_at;
  await sb.from('app_config').upsert({ key: CURSOR_KEY, value: last, updated_at: new Date().toISOString() });

  return NextResponse.json({ status: 'ok', attempted, found, cursor: last, results });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { unsubSignature } from '@/lib/claim-invite';

export const dynamic = 'force-dynamic';

/**
 * One-click unsubscribe for claim-invitation emails (2026-09-24).
 *
 * Link is `?e=<establishmentId>&s=<sig>`; the signature is an HMAC of the id
 * under CRON_SECRET, so no login is needed and the link can't be forged. Sets
 * establishments.claim_invite_optout so the invite cron never emails again.
 * Returns a small confirmation page.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f4f0;margin:0;padding:48px 16px;">
<div style="max-width:460px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06);">
<div style="font-size:32px;margin-bottom:12px;">🐾</div>
<h1 style="font-size:20px;color:#1a1a1a;margin:0 0 8px;">${title}</h1>
<p style="color:#666;font-size:15px;line-height:1.5;margin:0;">${body}</p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  );
}

export async function GET(request: NextRequest) {
  const e = request.nextUrl.searchParams.get('e') || '';
  const s = request.nextUrl.searchParams.get('s') || '';
  if (!e || !s || s !== unsubSignature(e)) {
    return page('Link not valid', 'This unsubscribe link is invalid or incomplete. If you keep receiving emails, reply to one and we will remove you right away.');
  }
  try {
    await admin().from('establishments').update({ claim_invite_optout: true }).eq('id', e);
  } catch {
    return page('Something went wrong', 'We could not process that just now. Please reply to the email and we will remove you.');
  }
  return page('You&rsquo;re unsubscribed', 'You will no longer receive listing-claim invitations from Paw Cities. Your listing stays live for dog owners to find.');
}

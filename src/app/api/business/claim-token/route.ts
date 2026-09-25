import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendClaimApproved } from '@/lib/email';
import { NON_CLAIMABLE } from '@/lib/claim-invite';

export const dynamic = 'force-dynamic';

/**
 * One-click, email-verified claim (2026-09-24).
 *
 * A unique token was emailed to a business's own contact address. Presenting it
 * proves control of that address — the strongest low-friction ownership signal
 * we have — so a claim made through it auto-approves with NO password step. The
 * business is provisioned an account via a magic-link invite they can complete
 * later to manage the listing.
 *
 * GET  ?token=...  → validate + return the listing to confirm (public, no auth)
 * POST { token }   → complete the claim (public, no auth — the token IS the auth)
 */

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function loadToken(sb: ReturnType<typeof admin>, token: string) {
  const { data } = await sb.from('claim_tokens').select('*').eq('token', token).maybeSingle();
  return data;
}

function tokenState(row: any): { ok: boolean; reason?: string } {
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.used_at) return { ok: false, reason: 'used' };
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true };
}

async function loadEstablishment(sb: ReturnType<typeof admin>, id: string) {
  const { data: est } = await sb.from('establishments')
    .select('id, name, slug, address, website, category_id, city_id, claimed_by, status')
    .eq('id', id).maybeSingle();
  if (!est) return { est: null, cityName: '', claimable: false };
  let cityName = '';
  if (est.city_id) {
    const { data: city } = await sb.from('cities').select('name').eq('id', est.city_id).maybeSingle();
    cityName = city?.name || '';
  }
  let claimable = true;
  if (est.category_id) {
    const { data: cat } = await sb.from('categories').select('slug').eq('id', est.category_id).maybeSingle();
    if (cat && NON_CLAIMABLE.includes(cat.slug)) claimable = false;
  }
  return { est, cityName, claimable };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  if (!token) return NextResponse.json({ valid: false, reason: 'no_token' }, { status: 400 });

  const sb = admin();
  const row = await loadToken(sb, token);
  const state = tokenState(row);
  if (!state.ok) return NextResponse.json({ valid: false, reason: state.reason });

  const { est, cityName, claimable } = await loadEstablishment(sb, row.establishment_id);
  if (!est) return NextResponse.json({ valid: false, reason: 'listing_missing' });

  const alreadyClaimed = !!est.claimed_by;
  return NextResponse.json({
    valid: true,
    alreadyClaimed,
    claimable,
    email: row.email,
    businessName: row.business_name || est.name,
    establishment: { id: est.id, name: est.name, slug: est.slug, address: est.address, city: cityName },
  });
}

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const token = (body.token || '').trim();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const sb = admin();
  const row = await loadToken(sb, token);
  const state = tokenState(row);
  if (!state.ok) return NextResponse.json({ error: 'invalid_token', reason: state.reason }, { status: 410 });

  const { est, claimable } = await loadEstablishment(sb, row.establishment_id);
  if (!est) return NextResponse.json({ error: 'listing_missing' }, { status: 404 });
  if (!claimable) {
    await sb.from('claim_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    return NextResponse.json({ error: 'not_claimable' }, { status: 400 });
  }

  // Already claimed, or a live claim already exists → don't double-claim.
  const { data: existingClaim } = await sb.from('business_claims')
    .select('id, status').eq('establishment_id', est.id).in('status', ['APPROVED', 'PENDING']).maybeSingle();
  if (est.claimed_by || existingClaim) {
    await sb.from('claim_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    return NextResponse.json({ alreadyClaimed: true, slug: est.slug });
  }

  const email = String(row.email).toLowerCase();
  const businessName = row.business_name || est.name;

  // ── Provision an auth account for this email (magic-link invite to set a
  //    password later). If one already exists, reuse it. ────────────────────
  let supabaseUserId: string | null = null;
  try {
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u: { email?: string; id: string }) => u.email?.toLowerCase() === email);
    if (existing) {
      supabaseUserId = existing.id;
    } else {
      const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(email, {
        data: { name: businessName, role: 'BUSINESS' },
      });
      if (inviteErr || !invited?.user) {
        console.error('[claim-token] invite failed:', inviteErr?.message);
        return NextResponse.json({ error: 'account_provisioning_failed' }, { status: 500 });
      }
      supabaseUserId = invited.user.id;
    }
  } catch (e: any) {
    console.error('[claim-token] auth provisioning error:', e?.message);
    return NextResponse.json({ error: 'account_provisioning_failed' }, { status: 500 });
  }

  // ── Get-or-create the users row, role BUSINESS ────────────────────────────
  let dbUserId: string | null = null;
  const { data: bySup } = await sb.from('users').select('id').eq('supabase_id', supabaseUserId).maybeSingle();
  if (bySup) {
    dbUserId = bySup.id;
    await sb.from('users').update({ role: 'BUSINESS' }).eq('id', dbUserId);
  } else {
    const { data: byEmail } = await sb.from('users').select('id, supabase_id').eq('email', email).maybeSingle();
    if (byEmail) {
      dbUserId = byEmail.id;
      await sb.from('users').update({ role: 'BUSINESS', supabase_id: supabaseUserId }).eq('id', dbUserId);
    } else {
      const { data: created, error: uErr } = await sb.from('users')
        .insert({ supabase_id: supabaseUserId, email, name: businessName, role: 'BUSINESS' })
        .select('id').single();
      if (uErr || !created) {
        console.error('[claim-token] user row create failed:', uErr?.message);
        return NextResponse.json({ error: 'user_create_failed' }, { status: 500 });
      }
      dbUserId = created.id;
    }
  }

  // ── Insert the approved claim (email-verified) + activate the listing ─────
  const nowIso = new Date().toISOString();
  const { error: claimErr } = await sb.from('business_claims').insert({
    user_id: dbUserId,
    establishment_id: est.id,
    business_name: businessName,
    contact_name: businessName,
    contact_email: email,
    verification_method: 'email_token',
    status: 'APPROVED',
    reviewed_at: nowIso,
    review_notes: 'Auto-approved: one-click claim from emailed verification link (email control proven)',
    source: row.source || 'email-invite',
  });
  if (claimErr) {
    console.error('[claim-token] claim insert failed:', claimErr.message);
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 });
  }

  await sb.from('establishments').update({
    is_verified: true, status: 'ACTIVE', claimed_by: dbUserId, claimed_at: nowIso,
  }).eq('id', est.id);

  // Consume the token.
  await sb.from('claim_tokens').update({ used_at: nowIso }).eq('id', row.id);

  // Best-effort: close the DM → claim attribution loop if we DMed this handle.
  try {
    const { data: full } = await sb.from('establishments').select('instagram_handle').eq('id', est.id).maybeSingle();
    const handle = full?.instagram_handle?.replace(/^@/, '');
    if (handle) await sb.from('dm_invitations').update({ claimed_listing: true }).eq('handle', handle);
  } catch { /* non-fatal */ }

  sendClaimApproved(email, businessName).catch(() => {});

  return NextResponse.json({ success: true, autoApproved: true, slug: est.slug });
}

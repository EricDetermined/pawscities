import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAmbassadorInvite } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ambassadors/requests
 *
 * Act on an ambassador_requests row from the admin review queue:
 *   { id, action: 'approve' | 'dismiss', tier?, sendEmail? }
 *
 * approve  -> generate an ambassador_invites code, optionally email it to the
 *             requester, and mark the request approved (storing the code).
 * dismiss  -> mark the request dismissed.
 *
 * Matches the auth posture of the sibling /api/admin/ambassadors route
 * (guarded at the admin surface, service-role DB access).
 */

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/1/O/0
  let code = 'PAW-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { id, action, tier, sendEmail = true } = await request.json();
    if (!id || !['approve', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 });
    }
    if (tier && !['explorer', 'trailblazer', 'pack_leader'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: req, error: fetchErr } = await supabase
      .from('ambassador_requests').select('*').eq('id', id).single();
    if (fetchErr || !req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (action === 'dismiss') {
      await supabase.from('ambassador_requests')
        .update({ status: 'dismissed', reviewed_at: new Date().toISOString() })
        .eq('id', id);
      return NextResponse.json({ success: true, status: 'dismissed' });
    }

    // approve: create an invite locked to the requester's email
    const code = generateInviteCode();
    const { error: invErr } = await supabase.from('ambassador_invites').insert({
      code,
      city: req.city || null,
      tier: tier || null,
      recipient_name: req.name || null,
      recipient_email: req.email?.toLowerCase().trim() || null,
      max_uses: 1,
      notes: `Approved from ambassador request${req.instagram_handle ? ` (@${req.instagram_handle})` : ''}`,
    });
    if (invErr) {
      console.error('[AMBASSADOR REQUESTS] invite creation failed:', invErr.message);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    let emailSent = false;
    if (sendEmail && req.email) {
      const r = await sendAmbassadorInvite(req.email.toLowerCase().trim(), req.name || '', code, req.city || undefined, tier || undefined);
      emailSent = r.success;
      if (!r.success) console.error('[AMBASSADOR REQUESTS] invite email failed:', r.error);
    }

    await supabase.from('ambassador_requests')
      .update({ status: 'approved', invite_code: code, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      status: 'approved',
      code,
      emailSent,
      inviteUrl: `https://pawcities.com/ambassadors?invite=${code}`,
    });
  } catch (err) {
    console.error('[AMBASSADOR REQUESTS] error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

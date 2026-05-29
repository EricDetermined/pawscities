import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Invite code is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const trimmedCode = code.trim().toUpperCase();

    const { data: invite, error } = await supabase
      .from('ambassador_invites')
      .select('*')
      .eq('code', trimmedCode)
      .single();

    if (error || !invite) {
      return NextResponse.json({ valid: false, error: 'Invalid invite code' }, { status: 404 });
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'This invite code has expired' }, { status: 410 });
    }

    // Check usage limit
    if (invite.times_used >= invite.max_uses) {
      return NextResponse.json({ valid: false, error: 'This invite code has already been used' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      invite: {
        code: invite.code,
        city: invite.city || null,
        tier: invite.tier || null,
        recipientName: invite.recipient_name || null,
      },
    });
  } catch (err) {
    console.error('[AMBASSADOR] Verify invite error:', err);
    return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 });
  }
}

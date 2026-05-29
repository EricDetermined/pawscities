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
    const body = await request.json();

    const {
      fullName,
      email,
      instagramHandle,
      city,
      whyJoin,
      howExplore,
      availability,
      followerCount,
      agreementAccepted,
      inviteCode,
    } = body;

    // Validate required fields
    if (!fullName || !email || !city || !whyJoin || !howExplore || !availability) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'A valid invite code is required to apply' },
        { status: 400 }
      );
    }

    if (!agreementAccepted) {
      return NextResponse.json(
        { error: 'You must accept the Ambassador Agreement to apply' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate availability/tier
    const validTiers = ['explorer', 'trailblazer', 'pack_leader'];
    if (!validTiers.includes(availability)) {
      return NextResponse.json(
        { error: 'Invalid tier selection' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check for existing application from this email
    const { data: existing } = await supabase
      .from('ambassador_applications')
      .select('id, status')
      .eq('email', email.toLowerCase().trim())
      .in('status', ['pending', 'approved'])
      .limit(1);

    if (existing && existing.length > 0) {
      const status = existing[0].status;
      if (status === 'pending') {
        return NextResponse.json(
          { error: 'You already have a pending application. We\'ll be in touch soon!' },
          { status: 409 }
        );
      }
      if (status === 'approved') {
        return NextResponse.json(
          { error: 'You\'re already an approved ambassador!' },
          { status: 409 }
        );
      }
    }

    // Validate invite code
    const trimmedInviteCode = inviteCode.trim().toUpperCase();
    const { data: invite, error: inviteError } = await supabase
      .from('ambassador_invites')
      .select('*')
      .eq('code', trimmedInviteCode)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite code has expired' }, { status: 410 });
    }

    if (invite.times_used >= invite.max_uses) {
      return NextResponse.json({ error: 'This invite code has already been used' }, { status: 410 });
    }

    // If invite is locked to a specific email, check it
    if (invite.recipient_email && invite.recipient_email.toLowerCase() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'This invite code is reserved for a different email address' }, { status: 403 });
    }

    // Generate referral code
    const referralCode = `${city.toLowerCase().replace(/\s+/g, '')}-${fullName.toLowerCase().split(' ')[0]}-${Math.random().toString(36).substring(2, 6)}`;

    // Insert application
    const { data, error } = await supabase
      .from('ambassador_applications')
      .insert({
        full_name: fullName.trim(),
        email: email.toLowerCase().trim(),
        instagram_handle: instagramHandle?.replace('@', '').trim() || null,
        city: city.trim(),
        why_join: whyJoin.trim(),
        how_explore: howExplore.trim(),
        availability,
        follower_count: followerCount || null,
        agreement_accepted: true,
        agreement_accepted_at: new Date().toISOString(),
        agreement_version: '1.0',
        status: 'pending',
        referral_code: referralCode,
        invite_code: trimmedInviteCode,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        user_agent: request.headers.get('user-agent') || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[AMBASSADOR] Application insert error:', error);
      return NextResponse.json(
        { error: 'Failed to submit application. Please try again.' },
        { status: 500 }
      );
    }

    // Increment invite usage
    await supabase
      .from('ambassador_invites')
      .update({ times_used: invite.times_used + 1 })
      .eq('id', invite.id);

    return NextResponse.json({
      success: true,
      applicationId: data.id,
      message: 'Application submitted successfully! We\'ll review it and get back to you within 5 business days.',
    });
  } catch (err) {
    console.error('[AMBASSADOR] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

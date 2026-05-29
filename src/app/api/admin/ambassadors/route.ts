import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAmbassadorInvite } from '@/lib/email';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PAW-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET /api/admin/ambassadors — List invites and applications
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [invitesResult, applicationsResult] = await Promise.all([
      supabase
        .from('ambassador_invites')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('ambassador_applications')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      invites: invitesResult.data || [],
      applications: applicationsResult.data || [],
    });
  } catch (err) {
    console.error('[ADMIN AMBASSADOR] Fetch error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// POST /api/admin/ambassadors — Create invite and optionally send email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      city,
      tier,
      recipientName,
      recipientEmail,
      maxUses = 1,
      expiresInDays,
      notes,
      sendInviteEmail = false,
    } = body;

    // Validate tier if provided
    if (tier && !['explorer', 'trailblazer', 'pack_leader'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const validCities = ['Geneva', 'Paris', 'London', 'Los Angeles', 'New York City', 'Barcelona', 'Sydney', 'Tokyo'];
    if (city && !validCities.includes(city)) {
      return NextResponse.json({ error: `Invalid city` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const code = generateInviteCode();

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('ambassador_invites')
      .insert({
        code,
        city: city || null,
        tier: tier || null,
        recipient_name: recipientName || null,
        recipient_email: recipientEmail?.toLowerCase().trim() || null,
        max_uses: maxUses,
        expires_at: expiresAt,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[ADMIN AMBASSADOR] Invite creation error:', error);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    const inviteUrl = `https://pawcities.com/ambassadors?invite=${code}`;

    // Send email if requested
    let emailSent = false;
    if (sendInviteEmail && recipientEmail) {
      const emailResult = await sendAmbassadorInvite(
        recipientEmail.toLowerCase().trim(),
        recipientName || '',
        code,
        city || undefined,
        tier || undefined,
      );
      emailSent = emailResult.success;
      if (!emailResult.success) {
        console.error('[ADMIN AMBASSADOR] Invite email failed:', emailResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      invite: {
        code: data.code,
        url: inviteUrl,
        city: data.city,
        tier: data.tier,
        recipientName: data.recipient_name,
        recipientEmail: data.recipient_email,
        maxUses: data.max_uses,
        expiresAt: data.expires_at,
      },
    });
  } catch (err) {
    console.error('[ADMIN AMBASSADOR] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

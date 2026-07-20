import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAmbassadorInvite } from '@/lib/email';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/1/O/0 to avoid confusion
  let code = 'PAW-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/ambassadors/invite — Generate a new invite code (admin only)
export async function POST(request: NextRequest) {
  try {
    // Authenticate via CRON_SECRET header (admin-only endpoint)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Validate city if provided
    const validCities = ['Atlanta', 'Barcelona', 'Geneva', 'London', 'Los Angeles', 'New York City', 'Paris', 'Sydney', 'Tokyo'];
    if (city && !validCities.includes(city)) {
      return NextResponse.json({ error: `Invalid city. Must be one of: ${validCities.join(', ')}` }, { status: 400 });
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
      console.error('[AMBASSADOR] Invite creation error:', error);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    const inviteUrl = `https://pawcities.com/ambassadors?invite=${code}`;

    // Send email invite if requested and email is provided
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
        console.error('[AMBASSADOR] Invite email failed:', emailResult.error);
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
    console.error('[AMBASSADOR] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// GET /api/ambassadors/invite — List all invite codes and applications (admin only)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (invitesResult.error) {
      return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
    }

    return NextResponse.json({
      invites: invitesResult.data,
      applications: applicationsResult.data || [],
    });
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

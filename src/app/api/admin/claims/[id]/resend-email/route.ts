import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin';
import { sendClaimApproved, sendClaimRejected } from '@/lib/email';

function getSupabaseServiceRole() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, supabase } = await requireAdmin();
  if (error) return error;
  if (!supabase) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  // Use service role client for auth admin operations (invites)
  const supabaseAdmin = getSupabaseServiceRole();

  const claimId = params.id;

  // Fetch the claim with establishment info
  const { data: claim, error: claimError } = await supabase
    .from('business_claims')
    .select('status, contact_email, business_name, establishment_id')
    .eq('id', claimId)
    .single();

  if (claimError || !claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  if (!claim.contact_email) {
    return NextResponse.json({ error: 'No contact email on this claim' }, { status: 400 });
  }

  // Get establishment name if business_name is missing
  let businessName = claim.business_name;
  if (!businessName && claim.establishment_id) {
    const { data: est } = await supabase
      .from('establishments')
      .select('name')
      .eq('id', claim.establishment_id)
      .single();
    businessName = est?.name || 'your business';
  }

  const status = claim.status.toUpperCase();

  if (status === 'APPROVED') {
    // Check if the contact email has a Supabase Auth account — if not, send invite
    let inviteSent = false;
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const hasAuthAccount = existingUsers?.users?.some(
        (u: { email?: string }) => u.email?.toLowerCase() === claim.contact_email.toLowerCase()
      );

      if (!hasAuthAccount) {
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          claim.contact_email,
          { data: { name: businessName || 'Business Owner', role: 'BUSINESS' } }
        );
        if (!inviteError) {
          inviteSent = true;
        } else {
          console.error(`Failed to invite ${claim.contact_email}:`, inviteError.message);
        }
      }
    } catch (inviteErr) {
      console.error('Auth invite check failed:', inviteErr);
    }

    // Also send the approval notification
    const result = await sendClaimApproved(claim.contact_email, businessName || 'your business');
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      message: inviteSent
        ? `Approval email + account invitation sent to ${claim.contact_email}`
        : `Approval email resent to ${claim.contact_email} (account already exists)`,
    });
  }

  if (status === 'REJECTED') {
    const result = await sendClaimRejected(claim.contact_email, businessName || 'your business');
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: `Rejection email resent to ${claim.contact_email}` });
  }

  return NextResponse.json({ error: `Cannot resend email for status: ${claim.status}` }, { status: 400 });
}

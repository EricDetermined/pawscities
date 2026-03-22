import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin';
import { sendClaimApproved, sendClaimRejected, sendBusinessAccountSetup } from '@/lib/email';

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
    let accountAction = 'none';
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === claim.contact_email.toLowerCase()
      );

      if (!existingUser) {
        // No account — create one with email_confirm=true so they can immediately reset password
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: claim.contact_email,
          email_confirm: true,
          user_metadata: { name: businessName || 'Business Owner', role: 'BUSINESS' },
        });
        if (createError) {
          console.error(`Failed to create user for ${claim.contact_email}:`, createError.message);
        } else {
          console.log(`Created verified account for ${claim.contact_email}`);
        }
      }

      // Whether account was just created or already existed — send password reset via Resend
      // This generates a reset link through Supabase Auth but the email goes through our SMTP (Resend)
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
        claim.contact_email,
        { redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com'}/reset-password` }
      );
      if (!resetError) {
        accountAction = 'password_reset_sent';
        console.log(`Password reset email sent to ${claim.contact_email}`);
      } else {
        console.error(`Failed to send password reset to ${claim.contact_email}:`, resetError.message);
        // Last resort: send setup instructions via our own Resend email
        await sendBusinessAccountSetup(claim.contact_email, businessName || 'your business');
        accountAction = 'setup_email_sent';
      }
    } catch (inviteErr) {
      console.error('Auth setup failed:', inviteErr);
    }

    // Also send the approval notification
    const result = await sendClaimApproved(claim.contact_email, businessName || 'your business');
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }
    const actionMessages: Record<string, string> = {
      invited: `Approval email + account invitation sent to ${claim.contact_email}`,
      magic_link_sent: `Approval email + sign-in link sent to ${claim.contact_email}`,
      password_reset_sent: `Approval email + password reset sent to ${claim.contact_email}`,
      account_exists: `Approval email resent to ${claim.contact_email} (account already verified)`,
      none: `Approval email resent to ${claim.contact_email}`,
    };
    return NextResponse.json({
      success: true,
      message: actionMessages[accountAction] || actionMessages.none,
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

import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendClaimApproved, sendClaimRejected } from '@/lib/email';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;
    const claimId = params.id;

    const { data: claim, error: claimError } = await supabase
      .from('business_claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Enrich with establishment and user data
    const [estResult, userResult] = await Promise.all([
      supabase
        .from('establishments')
        .select('id, name, slug, city_id, category_id, status, tier, rating, review_count')
        .eq('id', claim.establishment_id)
        .single(),
      supabase
        .from('users')
        .select('id, email, name')
        .eq('id', claim.user_id)
        .single(),
    ]);

    return NextResponse.json({
      ...claim,
      establishment: estResult.data,
      user: userResult.data,
    });
  } catch (error) {
    console.error('Admin claim GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claim' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;
    const claimId = params.id;
    const body = await request.json();

    const { action, reviewNotes } = body;

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get the claim first
    const { data: claim, error: claimError } = await supabase
      .from('business_claims')
      .select('establishment_id, user_id, status, contact_email, business_name')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    if (claim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending claims can be updated' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Update claim status
      const { error: updateClaimError } = await supabase
        .from('business_claims')
        .update({
          status: 'APPROVED',
          review_notes: reviewNotes || null,
          reviewed_by: authResult.dbUser?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (updateClaimError) {
        throw new Error(`Failed to update claim: ${updateClaimError.message}`);
      }

      // Update establishment to mark as verified/claimed
      const { error: updateEstError } = await supabase
        .from('establishments')
        .update({
          is_verified: true,
          status: 'ACTIVE',
          claimed_by: claim.user_id,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', claim.establishment_id);

      if (updateEstError) {
        throw new Error(`Failed to update establishment: ${updateEstError.message}`);
      }

      // Update user role to BUSINESS
      await supabase
        .from('users')
        .update({ role: 'BUSINESS' })
        .eq('id', claim.user_id);

      // Check if the contact email has a Supabase Auth account
      // If not, invite them so they can set up a password and access the dashboard
      let inviteSent = false;
      if (claim.contact_email) {
        try {
          // Check if auth user exists for this email
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const hasAuthAccount = existingUsers?.users?.some(
            (u: { email?: string }) => u.email?.toLowerCase() === claim.contact_email.toLowerCase()
          );

          if (!hasAuthAccount) {
            // Send an invite — this creates an auth account and emails them a magic link
            const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
              claim.contact_email,
              { data: { name: claim.business_name || 'Business Owner', role: 'BUSINESS' } }
            );
            if (!inviteError) {
              inviteSent = true;
              console.log(`Invited ${claim.contact_email} to create account`);
            } else {
              console.error(`Failed to invite ${claim.contact_email}:`, inviteError.message);
            }
          }
        } catch (inviteErr) {
          console.error('Auth invite check failed:', inviteErr);
        }

        // Send approval notification
        sendClaimApproved(claim.contact_email, claim.business_name || 'your business').catch(() => {});
      }

      return NextResponse.json({
        id: claimId,
        status: 'APPROVED',
        message: inviteSent
          ? `Claim approved. Invitation sent to ${claim.contact_email} to create their account.`
          : 'Claim approved successfully',
      });
    } else {
      // Reject the claim
      const { error: updateClaimError } = await supabase
        .from('business_claims')
        .update({
          status: 'REJECTED',
          review_notes: reviewNotes || null,
          reviewed_by: authResult.dbUser?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (updateClaimError) {
        throw new Error(`Failed to update claim: ${updateClaimError.message}`);
      }

      // Notify business owner (non-blocking)
      if (claim.contact_email) {
        sendClaimRejected(claim.contact_email, claim.business_name || 'your business', reviewNotes).catch(() => {});
      }

      return NextResponse.json({
        id: claimId,
        status: 'REJECTED',
        message: 'Claim rejected successfully',
      });
    }
  } catch (error) {
    console.error('Admin claim PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update claim' },
      { status: 500 }
    );
  }
}

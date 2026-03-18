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

      // Notify business owner (non-blocking)
      if (claim.contact_email) {
        sendClaimApproved(claim.contact_email, claim.business_name || 'your business').catch(() => {});
      }

      return NextResponse.json({
        id: claimId,
        status: 'APPROVED',
        message: 'Claim approved successfully',
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

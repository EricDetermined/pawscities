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
      .from('BusinessClaim')
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
        .from('Establishment')
        .select('id, name, slug, cityId, categoryId, status, tier, rating, reviewCount')
        .eq('id', claim.establishmentId)
        .single(),
      supabase
        .from('User')
        .select('id, email, name')
        .eq('id', claim.userId)
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
      .from('BusinessClaim')
      .select('establishmentId, userId, status, contactEmail, businessName')
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
        .from('BusinessClaim')
        .update({
          status: 'APPROVED',
          reviewNotes: reviewNotes || null,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (updateClaimError) {
        throw new Error(`Failed to update claim: ${updateClaimError.message}`);
      }

      // Update establishment to mark as verified/claimed
      const { error: updateEstError } = await supabase
        .from('Establishment')
        .update({
          isVerified: true,
          status: 'ACTIVE',
          updatedAt: new Date().toISOString(),
        })
        .eq('id', claim.establishmentId);

      if (updateEstError) {
        throw new Error(`Failed to update establishment: ${updateEstError.message}`);
      }

      // Notify business owner (non-blocking)
      if (claim.contactEmail) {
        sendClaimApproved(claim.contactEmail, claim.businessName || 'your business').catch(() => {});
      }

      return NextResponse.json({
        id: claimId,
        status: 'APPROVED',
        message: 'Claim approved successfully',
      });
    } else {
      // Reject the claim
      const { error: updateClaimError } = await supabase
        .from('BusinessClaim')
        .update({
          status: 'REJECTED',
          reviewNotes: reviewNotes || null,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (updateClaimError) {
        throw new Error(`Failed to update claim: ${updateClaimError.message}`);
      }

      // Notify business owner (non-blocking)
      if (claim.contactEmail) {
        sendClaimRejected(claim.contactEmail, claim.businessName || 'your business', reviewNotes).catch(() => {});
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

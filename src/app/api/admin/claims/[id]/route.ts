import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

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
      .select(`
        id,
        establishment_id,
        user_id,
        status,
        review_notes,
        created_at,
        updated_at,
        establishments(id, name, category, city_id, status, tier, claimed_by, rating, reviews_count),
        users(id, email, display_name)
      `)
      .eq('id', claimId)
      .single();

    if (claimError) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(claim);
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

    const { action, review_notes } = body;

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
      .select('establishment_id, user_id, status')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    if (claim.status !== 'pending') {
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
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (updateClaimError) {
        throw new Error(`Failed to update claim: ${updateClaimError.message}`);
      }

      // Update establishment tier to 'claimed'
      const { error: updateEstError } = await supabase
        .from('establishments')
        .update({
          tier: 'claimed',
          claimed_by: claim.user_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.establishment_id);

      if (updateEstError) {
        throw new Error(`Failed to update establishment: ${updateEstError.message}`);
      }

      return NextResponse.json({
        id: claimId,
        status: 'approved',
        message: 'Claim approved successfully',
      });
    } else {
      // Reject the claim
      const { error: updateClaimError } = await supabase
        .from('business_claims')
        .update({
          status: 'rejected',
          review_notes: review_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (updateClaimError) {
        throw new Error(`Failed to update claim: ${updateClaimError.message}`);
      }

      return NextResponse.json({
        id: claimId,
        status: 'rejected',
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

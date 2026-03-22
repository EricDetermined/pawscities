import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { sendClaimApproved, sendClaimRejected } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, supabase } = await requireAdmin();
  if (error) return error;
  if (!supabase) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

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
    const result = await sendClaimApproved(claim.contact_email, businessName || 'your business');
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: `Approval email resent to ${claim.contact_email}` });
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin';
import { sendAmbassadorApproved } from '@/lib/email';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// PATCH /api/admin/ambassadors/applications — approve or reject an application
// Body: { id: string, action: 'approve' | 'reject', notes?: string, tier?: string }
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const { id, action, notes, tier } = body as {
      id?: string; action?: string; notes?: string; tier?: string;
    };

    if (!id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: "id and action ('approve' | 'reject') are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: app, error: fetchError } = await supabase
      .from('ambassador_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const update: Record<string, unknown> = {
      status: newStatus,
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (notes) update.review_notes = String(notes).slice(0, 1000);
    if (action === 'approve') {
      update.tier = tier || app.tier || app.availability || 'explorer';
      update.badge_enabled = true;
    }

    const { error: updateError } = await supabase
      .from('ambassador_applications')
      .update(update)
      .eq('id', id);

    if (updateError) {
      console.error('[ADMIN AMBASSADOR] Failed to update application:', updateError);
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
    }

    // Congratulate approved ambassadors (non-blocking failure)
    let emailSent = false;
    if (action === 'approve' && app.email) {
      try {
        const firstName = (app.full_name || '').split(' ')[0] || 'there';
        const result = await sendAmbassadorApproved(
          app.email, firstName, app.city || 'your city', app.referral_code || ''
        );
        emailSent = !!result?.success;
      } catch (err) {
        console.error('[ADMIN AMBASSADOR] Approval email failed:', err);
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      emailSent,
      application: { ...app, ...update },
    });
  } catch (err) {
    console.error('[ADMIN AMBASSADOR] Application review error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

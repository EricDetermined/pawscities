import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Admin queue for establishment listings that were auto-created with
 * status='PENDING_REVIEW' (e.g. from the IG-follower outreach) and are hidden
 * from the public site until a human approves them.
 *
 * Matches the auth posture of the sibling /api/admin/ambassadors routes
 * (guarded at the admin surface, service-role DB access).
 */

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// GET /api/admin/pending-listings — list PENDING_REVIEW establishments,
// resolved to city + category names, newest first.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: establishments, error } = await supabase
      .from('establishments')
      .select(
        'id, name, slug, city_id, category_id, status, instagram_handle, instagram_handle_source, website, email, source, listing_type, created_at',
      )
      .eq('status', 'PENDING_REVIEW')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ADMIN PENDING LISTINGS] Fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch pending listings' }, { status: 500 });
    }

    const rows = establishments || [];

    // Resolve city + category names in bulk
    const cityIds = [...new Set(rows.map(r => r.city_id).filter(Boolean))];
    const categoryIds = [...new Set(rows.map(r => r.category_id).filter(Boolean))];

    const [citiesResult, categoriesResult] = await Promise.all([
      cityIds.length
        ? supabase.from('cities').select('id, name').in('id', cityIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      categoryIds.length
        ? supabase.from('categories').select('id, name').in('id', categoryIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const cityMap = new Map((citiesResult.data || []).map(c => [c.id, c.name]));
    const categoryMap = new Map((categoriesResult.data || []).map(c => [c.id, c.name]));

    const listings = rows.map(r => ({
      ...r,
      city_name: r.city_id ? cityMap.get(r.city_id) || null : null,
      category_name: r.category_id ? categoryMap.get(r.category_id) || null : null,
    }));

    return NextResponse.json({ listings });
  } catch (err) {
    console.error('[ADMIN PENDING LISTINGS] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// POST /api/admin/pending-listings — approve or reject a pending listing.
//   { id, action: 'approve' | 'reject' }
//   approve -> status='ACTIVE' (published to public)
//   reject  -> status='INACTIVE' (kept but hidden)
export async function POST(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: listing, error: fetchErr } = await supabase
      .from('establishments')
      .select('id, status')
      .eq('id', id)
      .single();
    if (fetchErr || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'ACTIVE' : 'INACTIVE';

    const { error: updateErr } = await supabase
      .from('establishments')
      .update({ status: newStatus })
      .eq('id', id);
    if (updateErr) {
      console.error('[ADMIN PENDING LISTINGS] Update failed:', updateErr.message);
      return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('[ADMIN PENDING LISTINGS] error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

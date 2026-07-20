export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentDbUser, getServiceClient } from '@/lib/community';

/**
 * Pack = mutual connection (request + approval).
 *
 * GET    /api/community/pack                      — my pack, incoming & outgoing requests
 * POST   /api/community/pack   { userId }         — send a pack request (auto-accepts if they already asked you)
 * PATCH  /api/community/pack   { requestId, action: 'accept' | 'decline' }
 * DELETE /api/community/pack   { userId }         — leave a pack / cancel a request
 */
export async function GET() {
  const viewer = await getCurrentDbUser();
  if (!viewer) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admin = getServiceClient();
  const { data: links, error } = await admin
    .from('pack_links')
    .select(
      `id, status, requester_id, addressee_id, created_at,
       requester:users!pack_links_requester_id_fkey(id, name, avatar),
       addressee:users!pack_links_addressee_id_fkey(id, name, avatar)`
    )
    .or(`requester_id.eq.${viewer.id},addressee_id.eq.${viewer.id}`)
    .neq('status', 'declined');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pack: any[] = [];
  const incoming: any[] = [];
  const outgoing: any[] = [];

  for (const link of links || []) {
    const l = link as any;
    const other = l.requester_id === viewer.id ? l.addressee : l.requester;
    const entry = { linkId: l.id, user: other, since: l.created_at };
    if (l.status === 'accepted') pack.push(entry);
    else if (l.addressee_id === viewer.id) incoming.push(entry);
    else outgoing.push(entry);
  }

  return NextResponse.json({ pack, incoming, outgoing });
}

export async function POST(request: NextRequest) {
  const viewer = await getCurrentDbUser();
  if (!viewer) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { userId } = await request.json();
  if (!userId || userId === viewer.id) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
  }

  const admin = getServiceClient();

  // Existing link in either direction?
  const { data: existing } = await admin
    .from('pack_links')
    .select('id, status, requester_id')
    .or(
      `and(requester_id.eq.${viewer.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${viewer.id})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json({ status: 'accepted' });
    }
    if (existing.requester_id === viewer.id) {
      if (existing.status === 'declined') {
        // Re-request after a decline
        const { error } = await admin
          .from('pack_links')
          .update({ status: 'pending', responded_at: null })
          .eq('id', existing.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ status: 'requested' });
    }
    // They already asked us — accept it
    const { error } = await admin
      .from('pack_links')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'accepted' });
  }

  const { error } = await admin.from('pack_links').insert({
    requester_id: viewer.id,
    addressee_id: userId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'requested' }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const viewer = await getCurrentDbUser();
  if (!viewer) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { requestId, action } = await request.json();
  if (!requestId || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const admin = getServiceClient();
  const { data: link } = await admin
    .from('pack_links')
    .select('id, addressee_id, status')
    .eq('id', requestId)
    .single();

  if (!link || link.addressee_id !== viewer.id) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (link.status !== 'pending') {
    return NextResponse.json({ error: 'Request already handled' }, { status: 409 });
  }

  const { error } = await admin
    .from('pack_links')
    .update({
      status: action === 'accept' ? 'accepted' : 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: action === 'accept' ? 'accepted' : 'declined' });
}

export async function DELETE(request: NextRequest) {
  const viewer = await getCurrentDbUser();
  if (!viewer) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const admin = getServiceClient();
  const { error } = await admin
    .from('pack_links')
    .delete()
    .or(
      `and(requester_id.eq.${viewer.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${viewer.id})`
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'removed' });
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentDbUser, getServiceClient } from '@/lib/community';
import { sendNewFollowerEmail } from '@/lib/email';

/**
 * POST /api/community/follow   { userId }  — follow a user (instant, one-way)
 * DELETE /api/community/follow { userId }  — unfollow
 */
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

  const { data: target } = await admin
    .from('users')
    .select('id, email, name')
    .eq('id', userId)
    .single();
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Was this follow already in place? (Determines whether to notify.)
  const { data: existing } = await admin
    .from('follows')
    .select('id')
    .eq('follower_id', viewer.id)
    .eq('following_id', userId)
    .maybeSingle();

  const { error } = await admin
    .from('follows')
    .upsert(
      { follower_id: viewer.id, following_id: userId },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify on a genuinely new follow (fire-and-forget)
  if (!existing && target.email) {
    const { data: follower } = await admin
      .from('users')
      .select('name')
      .eq('id', viewer.id)
      .single();
    sendNewFollowerEmail(target.email, follower?.name || 'A fellow dog lover')
      .catch(err => console.error('[FOLLOW] Notification email failed:', err));
  }

  return NextResponse.json({ following: true }, { status: 201 });
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
    .from('follows')
    .delete()
    .eq('follower_id', viewer.id)
    .eq('following_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ following: false });
}

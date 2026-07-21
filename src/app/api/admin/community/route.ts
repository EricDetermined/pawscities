export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceClient } from '@/lib/community';

/**
 * GET /api/admin/community — moderation view of the community layer:
 * public dogs (with owner contact), plus headline counts.
 * PATCH — { dogId, action: 'make_private' | 'make_public' }
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: dogs }, follows, packs, checkinsWeek, publicCount] = await Promise.all([
    admin
      .from('dog_profiles')
      .select('id, slug, name, breed, photo, photos, is_public, created_at, users:user_id(name, email, home_city)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(200),
    admin.from('follows').select('id', { count: 'exact', head: true }),
    admin.from('pack_links').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
    admin.from('check_ins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    admin.from('dog_profiles').select('id', { count: 'exact', head: true }).eq('is_public', true),
  ]);

  const { data: cities } = await admin.from('cities').select('id, name');
  const cityById = new Map((cities || []).map(c => [c.id, c.name]));

  return NextResponse.json({
    counts: {
      publicDogs: publicCount.count ?? 0,
      follows: follows.count ?? 0,
      packs: packs.count ?? 0,
      checkInsThisWeek: checkinsWeek.count ?? 0,
    },
    dogs: (dogs || []).map((d: any) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      breed: d.breed,
      photo: d.photo || (Array.isArray(d.photos) ? d.photos[0] : null),
      createdAt: d.created_at,
      owner: {
        name: d.users?.name || null,
        email: d.users?.email || null,
        city: d.users?.home_city ? cityById.get(d.users.home_city) || null : null,
      },
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { dogId, action } = await request.json();
  if (!dogId || !['make_private', 'make_public'].includes(action)) {
    return NextResponse.json({ error: 'dogId and action (make_private|make_public) required' }, { status: 400 });
  }

  const admin = getServiceClient();
  const { error } = await admin
    .from('dog_profiles')
    .update({ is_public: action === 'make_public' })
    .eq('id', dogId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, isPublic: action === 'make_public' });
}

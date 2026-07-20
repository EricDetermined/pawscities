export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentDbUser, getServiceClient } from '@/lib/community';

/**
 * GET /api/community/feed
 * Activity feed of check-ins and reviews from people you follow
 * (plus your pack members). Paginated with limit/offset.
 */
export async function GET(request: NextRequest) {
  const viewer = await getCurrentDbUser();
  if (!viewer) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  const admin = getServiceClient();

  // Who am I following + who is in my pack?
  const [{ data: follows }, { data: packLinks }] = await Promise.all([
    admin.from('follows').select('following_id').eq('follower_id', viewer.id),
    admin
      .from('pack_links')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${viewer.id},addressee_id.eq.${viewer.id}`),
  ]);

  const userIds = new Set<string>();
  (follows || []).forEach(f => userIds.add(f.following_id));
  (packLinks || []).forEach(l => {
    userIds.add(l.requester_id === viewer.id ? l.addressee_id : l.requester_id);
  });

  if (userIds.size === 0) {
    return NextResponse.json({ items: [], total: 0, followingCount: 0 });
  }

  const { data: activities, error, count } = await admin
    .from('activities')
    .select(
      `id, type, created_at, metadata,
       user:users(id, name, avatar),
       establishment:establishments(id, slug, name, primary_image, city:cities(slug, name)),
       check_in:check_ins(id, note, rating, photo, dog:dog_profiles(id, slug, name, photo, is_public)),
       review:reviews(id, title, rating, content, status)`,
      { count: 'exact' }
    )
    .in('user_id', Array.from(userIds))
    .in('type', ['check_in', 'review'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (activities || [])
    // Hide reviews that aren't approved yet
    .filter((a: any) => a.type !== 'review' || (a.review && a.review.status === 'APPROVED'))
    .map((a: any) => ({
      id: a.id,
      type: a.type,
      createdAt: a.created_at,
      user: a.user,
      establishment: a.establishment
        ? {
            id: a.establishment.id,
            slug: a.establishment.slug,
            name: a.establishment.name,
            image: a.establishment.primary_image,
            city: a.establishment.city,
          }
        : null,
      checkIn:
        a.type === 'check_in' && a.check_in
          ? {
              note: a.check_in.note,
              rating: a.check_in.rating,
              photo: a.check_in.photo,
              dog:
                a.check_in.dog && a.check_in.dog.is_public
                  ? {
                      slug: a.check_in.dog.slug,
                      name: a.check_in.dog.name,
                      photo: a.check_in.dog.photo,
                    }
                  : null,
            }
          : null,
      review:
        a.type === 'review' && a.review
          ? {
              title: a.review.title,
              rating: a.review.rating,
              content: a.review.content,
            }
          : null,
    }));

  return NextResponse.json({
    items,
    total: count ?? items.length,
    followingCount: userIds.size,
  });
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentDbUser,
  getServiceClient,
  PUBLIC_DOG_FIELDS,
} from '@/lib/community';

/**
 * GET /api/community/dogs/[slug]
 * Public dog profile: dog + owner (safe fields) + owner's other public dogs,
 * owner follower counts, and the viewer's follow/pack state.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const admin = getServiceClient();

  const { data: dog, error } = await admin
    .from('dog_profiles')
    .select(`${PUBLIC_DOG_FIELDS}, users!inner(id, name, avatar, home_city, created_at)`)
    .eq('slug', params.slug)
    .eq('is_public', true)
    .single();

  if (error || !dog) {
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
  }

  const owner = (dog as any).users;

  const [cityRes, otherDogsRes, followersRes, followingRes, viewer] =
    await Promise.all([
      owner.home_city
        ? admin.from('cities').select('slug, name').eq('id', owner.home_city).single()
        : Promise.resolve({ data: null }),
      admin
        .from('dog_profiles')
        .select('id, slug, name, breed, photo, photos')
        .eq('user_id', owner.id)
        .eq('is_public', true)
        .neq('id', dog.id),
      admin
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', owner.id),
      admin
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', owner.id),
      getCurrentDbUser(),
    ]);

  // Viewer's relationship to the owner
  let isFollowing = false;
  let packStatus: string | null = null;
  let isOwnDog = false;
  if (viewer) {
    isOwnDog = viewer.id === owner.id;
    if (!isOwnDog) {
      const [{ data: follow }, { data: pack }] = await Promise.all([
        admin
          .from('follows')
          .select('id')
          .eq('follower_id', viewer.id)
          .eq('following_id', owner.id)
          .maybeSingle(),
        admin
          .from('pack_links')
          .select('id, status, requester_id')
          .or(
            `and(requester_id.eq.${viewer.id},addressee_id.eq.${owner.id}),and(requester_id.eq.${owner.id},addressee_id.eq.${viewer.id})`
          )
          .neq('status', 'declined')
          .maybeSingle(),
      ]);
      isFollowing = !!follow;
      if (pack) {
        packStatus =
          pack.status === 'accepted'
            ? 'accepted'
            : pack.requester_id === viewer.id
              ? 'requested'
              : 'incoming';
      }
    }
  }

  const d = dog as any;
  return NextResponse.json({
    dog: {
      id: d.id,
      slug: d.slug,
      name: d.name,
      breed: d.breed,
      birthDate: d.birth_date,
      size: d.size,
      personality: d.personality,
      bio: d.bio,
      photo: d.photo || (Array.isArray(d.photos) ? d.photos[0] : null),
      photos: d.photos || (d.photo ? [d.photo] : []),
      createdAt: d.created_at,
    },
    owner: {
      id: owner.id,
      name: owner.name,
      avatar: owner.avatar,
      memberSince: owner.created_at,
      city: cityRes.data ? { slug: cityRes.data.slug, name: cityRes.data.name } : null,
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      otherDogs: (otherDogsRes.data || []).map((o: any) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        breed: o.breed,
        photo: o.photo || (Array.isArray(o.photos) ? o.photos[0] : null),
      })),
    },
    viewer: {
      isAuthenticated: !!viewer,
      isOwnDog,
      isFollowing,
      packStatus,
    },
  });
}

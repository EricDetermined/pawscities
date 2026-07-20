export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/community';

/**
 * GET /api/community/activity?city=SLUG&limit=8
 * Recent public community activity (check-ins + approved reviews) in a city.
 * Public endpoint; exposes only safe fields.
 */
export async function GET(request: NextRequest) {
  const admin = getServiceClient();
  const { searchParams } = new URL(request.url);
  const citySlug = searchParams.get('city');
  const limit = Math.min(parseInt(searchParams.get('limit') || '8', 10), 20);

  let cityId: string | null = null;
  if (citySlug) {
    const { data: city } = await admin
      .from('cities')
      .select('id')
      .eq('slug', citySlug)
      .maybeSingle();
    if (!city) return NextResponse.json({ items: [] });
    cityId = city.id;
  }

  let query = admin
    .from('activities')
    .select(
      `id, type, created_at,
       user:users(name, avatar),
       establishment:establishments!inner(slug, name, city_id, cities(slug, name)),
       check_in:check_ins(rating, note, dog:dog_profiles(slug, name, photo, is_public)),
       review:reviews(rating, title, status)`
    )
    .in('type', ['check_in', 'review'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cityId) {
    query = query.eq('establishment.city_id', cityId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data || [])
    .filter((a: any) => a.type !== 'review' || (a.review && a.review.status === 'APPROVED'))
    .map((a: any) => ({
      id: a.id,
      type: a.type,
      createdAt: a.created_at,
      userName: a.user?.name ? String(a.user.name).split(' ')[0] : 'A dog lover',
      userAvatar: a.user?.avatar || null,
      establishment: a.establishment
        ? { slug: a.establishment.slug, name: a.establishment.name, citySlug: a.establishment.cities?.slug }
        : null,
      rating: a.check_in?.rating || a.review?.rating || null,
      dog:
        a.check_in?.dog && a.check_in.dog.is_public
          ? { slug: a.check_in.dog.slug, name: a.check_in.dog.name, photo: a.check_in.dog.photo }
          : null,
    }));

  return NextResponse.json({ items });
}

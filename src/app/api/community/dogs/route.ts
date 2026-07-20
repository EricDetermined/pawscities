export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, PUBLIC_DOG_FIELDS } from '@/lib/community';

/**
 * GET /api/community/dogs
 * Public directory of dogs whose owners opted in (is_public = true).
 * Query params:
 *   city   — city slug (matches the owner's home city)
 *   search — dog name search
 *   limit / offset — pagination (default 24)
 */
export async function GET(request: NextRequest) {
  const admin = getServiceClient();
  const { searchParams } = new URL(request.url);
  const citySlug = searchParams.get('city');
  const search = searchParams.get('search');
  const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 60);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  // Resolve city slug -> id (optional filter)
  let cityId: string | null = null;
  if (citySlug) {
    const { data: city } = await admin
      .from('cities')
      .select('id')
      .eq('slug', citySlug)
      .single();
    if (!city) {
      return NextResponse.json({ dogs: [], total: 0 });
    }
    cityId = city.id;
  }

  let query = admin
    .from('dog_profiles')
    .select(
      `${PUBLIC_DOG_FIELDS}, users!inner(id, name, avatar, home_city)`,
      { count: 'exact' }
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cityId) {
    query = query.eq('users.home_city', cityId);
  }
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data: dogs, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map owner home_city to city slug/name for display + return active city list for filters
  const { data: cities } = await admin
    .from('cities')
    .select('id, slug, name, is_active')
    .order('name');
  const cityById = new Map((cities || []).map(c => [c.id, c]));
  const activeCities = (cities || [])
    .filter(c => c.is_active)
    .map(c => ({ slug: c.slug, name: c.name }));

  const result = (dogs || []).map((d: any) => {
    const owner = d.users;
    const city = owner?.home_city ? cityById.get(owner.home_city) : null;
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      breed: d.breed,
      birthDate: d.birth_date,
      size: d.size,
      bio: d.bio || d.personality,
      photo: d.photo || (Array.isArray(d.photos) ? d.photos[0] : null),
      createdAt: d.created_at,
      owner: owner
        ? { id: owner.id, name: owner.name, avatar: owner.avatar }
        : null,
      city: city ? { slug: city.slug, name: city.name } : null,
    };
  });

  return NextResponse.json({
    dogs: result,
    total: count ?? result.length,
    cities: activeCities,
  });
}

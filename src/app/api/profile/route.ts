import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let { data: dbUser } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    const { data: newUser } = await supabaseAdmin
      .from('users')
      .insert({
        supabase_id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Dog Lover',
        avatar: user.user_metadata?.avatar_url,
      })
      .select('*')
      .single();
    dbUser = newUser;
  }

  const [dogs, reviews, favorites, checkins] = await Promise.all([
    supabase.from('dog_profiles').select('id', { count: 'exact' }).eq('user_id', dbUser!.id),
    supabase.from('reviews').select('id', { count: 'exact' }).eq('user_id', dbUser!.id),
    supabase.from('favorites').select('id', { count: 'exact' }).eq('user_id', dbUser!.id),
    supabase.from('check_ins').select('id', { count: 'exact' }).eq('user_id', dbUser!.id),
  ]);

  // users.home_city stores a city UUID; the profile UIs work with slugs.
  let userOut = dbUser;
  if (dbUser?.home_city) {
    const { data: homeCityRow } = await supabaseAdmin
      .from('cities')
      .select('slug')
      .eq('id', dbUser.home_city)
      .maybeSingle();
    userOut = { ...dbUser, home_city: homeCityRow?.slug || null };
  }

  return NextResponse.json({
    user: userOut,
    stats: {
      dogs: dogs.count || 0,
      reviews: reviews.count || 0,
      favorites: favorites.count || 0,
      checkIns: checkins.count || 0,
    },
  });
}

export async function PUT(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { name, language, homeCity } = await request.json();

  // The UI sends a city slug, but users.home_city is a UUID FK to cities(id).
  // Resolve slug -> id (also accept a raw UUID or null to clear).
  let homeCityId: string | null | undefined = undefined;
  if (homeCity !== undefined) {
    if (!homeCity) {
      homeCityId = null;
    } else {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(homeCity);
      const { data: city } = await supabaseAdmin
        .from('cities')
        .select('id')
        .eq(isUuid ? 'id' : 'slug', homeCity)
        .maybeSingle();
      if (!city) {
        return NextResponse.json({ error: `Unknown city: ${homeCity}` }, { status: 400 });
      }
      homeCityId = city.id;
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from('users')
    .update({
      ...(name !== undefined && { name }),
      ...(language !== undefined && { language }),
      ...(homeCityId !== undefined && { home_city: homeCityId }),
    })
    .eq('supabase_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return home_city as a slug for UI consistency (see GET)
  const userOut =
    updated?.home_city && homeCity !== undefined
      ? { ...updated, home_city: homeCity || null }
      : updated;

  return NextResponse.json({ user: userOut });
}

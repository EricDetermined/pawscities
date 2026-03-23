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

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ favorites: [] });
  }

  const { data: favorites, error } = await supabase
    .from('favorites')
    .select('*, establishments:establishment_id(id, name, slug, city_id, address, primary_image, rating, review_count, category_id, cities:city_id(slug))')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorites: favorites || [] });
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { establishmentId } = await request.json();
  if (!establishmentId) {
    return NextResponse.json({ error: 'Establishment ID is required' }, { status: 400 });
  }

  let { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    const { data: newUser } = await supabaseAdmin
      .from('users')
      .insert({
        supabase_id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Dog Lover',
      })
      .select('id')
      .single();
    dbUser = newUser;
  }

  if (!dbUser) {
    return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });
  }

  // Toggle favorite
  const { data: existing } = await supabaseAdmin
    .from('favorites')
    .select('id')
    .eq('user_id', dbUser.id)
    .eq('establishment_id', establishmentId)
    .single();

  if (existing) {
    await supabaseAdmin.from('favorites').delete().eq('id', existing.id);
    return NextResponse.json({ favorited: false, message: 'Removed from favorites' });
  } else {
    const { error } = await supabaseAdmin
      .from('favorites')
      .insert({ user_id: dbUser.id, establishment_id: establishmentId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ favorited: true, message: 'Added to favorites' }, { status: 201 });
  }
}

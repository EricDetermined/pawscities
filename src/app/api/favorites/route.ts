import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: dbUser } = await supabase
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ favorites: [] });
  }

  const { data: favorites, error } = await supabase
    .from('Favorite')
    .select('*, Establishment:establishmentId(id, name, nameFr, slug, cityId, address, primaryImage, rating, reviewCount, category:categoryId(name, icon))')
    .eq('userId', dbUser.id)
    .order('createdAt', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorites: favorites || [] });
}

export async function POST(request: NextRequest) {
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
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser) {
    const { data: newUser } = await supabase
      .from('User')
      .insert({
        supabaseId: user.id,
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
  const { data: existing } = await supabase
    .from('Favorite')
    .select('id')
    .eq('userId', dbUser.id)
    .eq('establishmentId', establishmentId)
    .single();

  if (existing) {
    await supabase.from('Favorite').delete().eq('id', existing.id);
    return NextResponse.json({ favorited: false, message: 'Removed from favorites' });
  } else {
    const { error } = await supabase
      .from('Favorite')
      .insert({ userId: dbUser.id, establishmentId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ favorited: true, message: 'Added to favorites' }, { status: 201 });
  }
}

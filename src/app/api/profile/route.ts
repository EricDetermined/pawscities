import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let { data: dbUser } = await supabase
    .from('User')
    .select('*')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser) {
    const { data: newUser } = await supabase
      .from('User')
      .insert({
        supabaseId: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Dog Lover',
        avatar: user.user_metadata?.avatar_url,
      })
      .select('*')
      .single();
    dbUser = newUser;
  }

  const [dogs, reviews, favorites, checkins] = await Promise.all([
    supabase.from('DogProfile').select('id', { count: 'exact' }).eq('userId', dbUser!.id),
    supabase.from('Review').select('id', { count: 'exact' }).eq('userId', dbUser!.id),
    supabase.from('Favorite').select('id', { count: 'exact' }).eq('userId', dbUser!.id),
    supabase.from('CheckIn').select('id', { count: 'exact' }).eq('userId', dbUser!.id),
  ]);

  return NextResponse.json({
    user: dbUser,
    stats: {
      dogs: dogs.count || 0,
      reviews: reviews.count || 0,
      favorites: favorites.count || 0,
      checkIns: checkins.count || 0,
    },
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { name, language, homeCity } = await request.json();

  const { data: updated, error } = await supabase
    .from('User')
    .update({
      ...(name !== undefined && { name }),
      ...(language !== undefined && { language }),
      ...(homeCity !== undefined && { homeCity }),
    })
    .eq('supabaseId', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: updated });
}

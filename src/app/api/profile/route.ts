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
  const supabaseAdmin = getSupabaseAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { name, language, homeCity } = await request.json();

  const { data: updated, error } = await supabaseAdmin
    .from('users')
    .update({
      ...(name !== undefined && { name }),
      ...(language !== undefined && { language }),
      ...(homeCity !== undefined && { home_city: homeCity }),
    })
    .eq('supabase_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: updated });
}

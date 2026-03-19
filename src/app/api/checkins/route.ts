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

  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get('establishmentId');

  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ checkIns: [] });
  }

  let query = supabase
    .from('check_ins')
    .select('*, establishments:establishment_id(name, slug, city_id, primary_image), dog_profiles:dog_id(name, photo)')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (establishmentId) {
    query = query.eq('establishment_id', establishmentId);
  }

  const { data: checkIns, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkIns: checkIns || [] });
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { establishmentId, dogId, note, rating } = await request.json();
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

  const { data: checkIn, error } = await supabaseAdmin
    .from('check_ins')
    .insert({
      user_id: dbUser.id,
      establishment_id: establishmentId,
      dog_id: dogId || null,
      note: note || null,
      rating: rating || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create activity
  await supabaseAdmin.from('activities').insert({
    user_id: dbUser.id,
    activity_type: 'CHECKIN',
    entity_id: checkIn.id,
    entity_type: 'check_in',
  });

  return NextResponse.json({ checkIn }, { status: 201 });
}

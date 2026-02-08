import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get('establishmentId');

  const { data: dbUser } = await supabase
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ checkIns: [] });
  }

  let query = supabase
    .from('CheckIn')
    .select('*, Establishment:establishmentId(name, slug, cityId, primaryImage), DogProfile:dogId(name, photo)')
    .eq('userId', dbUser.id)
    .order('createdAt', { ascending: false })
    .limit(50);

  if (establishmentId) {
    query = query.eq('establishmentId', establishmentId);
  }

  const { data: checkIns, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkIns: checkIns || [] });
}

export async function POST(request: NextRequest) {
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

  const { data: checkIn, error } = await supabase
    .from('CheckIn')
    .insert({
      userId: dbUser.id,
      establishmentId,
      dogId: dogId || null,
      note: note || null,
      rating: rating || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create activity
  await supabase.from('Activity').insert({
    userId: dbUser.id,
    type: 'CHECKIN',
    checkInId: checkIn.id,
    establishmentId,
  });

  return NextResponse.json({ checkIn }, { status: 201 });
}

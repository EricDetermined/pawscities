import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
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
    return NextResponse.json({ dogs: [] });
  }

  const { data: dogs, error } = await supabase
    .from('DogProfile')
    .select('*')
    .eq('userId', dbUser.id)
    .order('createdAt', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dogs: dogs || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { name, breed, birthDate, size, personality, photo } = await request.json();
  if (!name) {
    return NextResponse.json({ error: 'Dog name is required' }, { status: 400 });
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

  const { data: dog, error } = await supabase
    .from('DogProfile')
    .insert({
      userId: dbUser.id,
      name,
      breed: breed || null,
      birthDate: birthDate || null,
      size: size || 'MEDIUM',
      personality: personality || null,
      photo: photo || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dog }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id, name, breed, birthDate, size, personality, photo } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Dog profile ID is required' }, { status: 400 });
  }

  const { data: dbUser } = await supabase
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('DogProfile')
    .select('id')
    .eq('id', id)
    .eq('userId', dbUser.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Dog profile not found or unauthorized' }, { status: 404 });
  }

  const { data: dog, error } = await supabase
    .from('DogProfile')
    .update({
      ...(name !== undefined && { name }),
      ...(breed !== undefined && { breed }),
      ...(birthDate !== undefined && { birthDate }),
      ...(size !== undefined && { size }),
      ...(personality !== undefined && { personality }),
      ...(photo !== undefined && { photo }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dog });
}

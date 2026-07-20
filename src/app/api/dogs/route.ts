import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
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
    return NextResponse.json({ dogs: [] });
  }

  const { data: dogs, error } = await supabase
    .from('dog_profiles')
    .select('*')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false });

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

  const { name, breed, birthDate, size, personality, photo, photos, isPublic, bio } =
    await request.json();
  if (!name) {
    return NextResponse.json({ error: 'Dog name is required' }, { status: 400 });
  }
  const photoList: string[] | null =
    Array.isArray(photos) && photos.length > 0 ? photos : photo ? [photo] : null;

  let { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    const { data: newUser } = await supabase
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

  // URL-safe slug: name + short random suffix
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) +
    '-' +
    Math.random().toString(36).slice(2, 8);

  const { data: dog, error } = await supabase
    .from('dog_profiles')
    .insert({
      user_id: dbUser.id,
      name,
      breed: breed || null,
      birth_date: birthDate || null,
      size: size || 'MEDIUM',
      personality: personality || null,
      photo: photoList ? photoList[0] : null,
      photos: photoList,
      is_public: isPublic === true,
      bio: bio || null,
      slug,
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

  const { id, name, breed, birthDate, size, personality, photo, photos, isPublic, bio } =
    await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Dog profile ID is required' }, { status: 400 });
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('dog_profiles')
    .select('id')
    .eq('id', id)
    .eq('user_id', dbUser.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Dog profile not found or unauthorized' }, { status: 404 });
  }

  const { data: dog, error } = await supabase
    .from('dog_profiles')
    .update({
      ...(name !== undefined && { name }),
      ...(breed !== undefined && { breed }),
      ...(birthDate !== undefined && { birth_date: birthDate }),
      ...(size !== undefined && { size }),
      ...(personality !== undefined && { personality }),
      ...(photo !== undefined && { photo }),
      ...(Array.isArray(photos) && {
        photos: photos.length > 0 ? photos : null,
        photo: photos.length > 0 ? photos[0] : null,
      }),
      ...(isPublic !== undefined && { is_public: isPublic === true }),
      ...(bio !== undefined && { bio }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dog });
}

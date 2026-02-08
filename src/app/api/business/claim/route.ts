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
    return NextResponse.json({ claims: [] });
  }

  const { data: claims, error } = await supabase
    .from('BusinessClaim')
    .select('*, Establishment:establishmentId(name, slug, cityId, address, primaryImage)')
    .eq('userId', dbUser.id)
    .order('createdAt', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claims: claims || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { establishmentId, businessName, contactName, contactEmail, contactPhone } = await request.json();

  if (!establishmentId || !businessName || !contactName || !contactEmail) {
    return NextResponse.json({ error: 'Establishment ID, business name, contact name, and email are required' }, { status: 400 });
  }

  // Check if already claimed
  const { data: existingClaim } = await supabase
    .from('BusinessClaim')
    .select('id, status')
    .eq('establishmentId', establishmentId)
    .single();

  if (existingClaim) {
    if (existingClaim.status === 'APPROVED') {
      return NextResponse.json({ error: 'This business has already been claimed' }, { status: 409 });
    }
    if (existingClaim.status === 'PENDING') {
      return NextResponse.json({ error: 'A claim for this business is already pending review' }, { status: 409 });
    }
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
        name: user.user_metadata?.name || contactName,
      })
      .select('id')
      .single();
    dbUser = newUser;
  }

  if (!dbUser) {
    return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
  }

  const { data: claim, error } = await supabase
    .from('BusinessClaim')
    .insert({
      userId: dbUser.id,
      establishmentId,
      businessName,
      contactName,
      contactEmail,
      contactPhone: contactPhone || null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update user role to BUSINESS
  await supabase.from('User').update({ role: 'BUSINESS' }).eq('id', dbUser.id);

  return NextResponse.json({ claim }, { status: 201 });
}

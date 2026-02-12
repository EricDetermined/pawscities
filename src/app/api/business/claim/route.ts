import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json({ claims: [] });
  }

  const { data: claims, error } = await supabase
    .from('business_claims')
    .select('*, establishments:establishment_id(name, slug, city_id, address, primary_image)')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false });

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
    return NextResponse.json(
      { error: 'Establishment ID, business name, contact name, and email are required' },
      { status: 400 }
    );
  }

  // Check if already claimed
  const { data: existingClaim } = await supabase
    .from('business_claims')
    .select('id, status')
    .eq('establishment_id', establishmentId)
    .single();

  if (existingClaim) {
    if (existingClaim.status === 'approved') {
      return NextResponse.json(
        { error: 'This business has already been claimed' },
        { status: 409 }
      );
    }
    if (existingClaim.status === 'pending') {
      return NextResponse.json(
        { error: 'A claim for this business is already pending review' },
        { status: 409 }
      );
    }
  }

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
    .from('business_claims')
    .insert({
      user_id: dbUser.id,
      establishment_id: establishmentId,
      business_name: businessName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update user role to BUSINESS
  await supabase.from('users').update({ role: 'BUSINESS' }).eq('id', dbUser.id);

  return NextResponse.json({ claim }, { status: 201 });
}

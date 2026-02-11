import { requireBusinessOrAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the business's approved claim
    const { data: claim, error: claimError } = await supabase
      .from('BusinessClaim')
      .select('establishmentId')
      .eq('userId', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Get the establishment
    const { data: establishment, error: estError } = await supabase
      .from('Establishment')
      .select('*')
      .eq('id', claim.establishmentId)
      .single();

    if (estError || !establishment) {
      return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
    }

    return NextResponse.json({ establishment });
  } catch (error) {
    console.error('Listing GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();

  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { description, phone, website, dogFeatures, openingHours } = body;

    // Get the business's approved claim
    const { data: claim, error: claimError } = await supabase
      .from('BusinessClaim')
      .select('establishmentId')
      .eq('userId', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Update the establishment
    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website;
    if (dogFeatures !== undefined) updateData.dogFeatures = dogFeatures;
    if (openingHours !== undefined) updateData.hours = openingHours;

    const { data: updated, error: updateError } = await supabase
      .from('Establishment')
      .update(updateData)
      .eq('id', claim.establishmentId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ establishment: updated });
  } catch (error) {
    console.error('Listing PUT error:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}

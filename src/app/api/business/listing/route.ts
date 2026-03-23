import { requireBusinessOrAdmin, getEstablishmentForUser } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();
  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the establishment for this user (handles admin fallback)
    const result = await getEstablishmentForUser(supabase, dbUser);

    if (!result) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Get the establishment
    const { data: establishment, error: estError } = await supabase
      .from('establishments')
      .select('*')
      .eq('id', result.establishmentId)
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
    const { description, phone, website: rawWebsite, dogFeatures, openingHours } = body;
    // Normalize website URL - ensure https:// prefix
    const website = rawWebsite ? (rawWebsite.match(/^https?:\/\//) ? rawWebsite : `https://${rawWebsite}`) : rawWebsite;

    // Get the establishment for this user (handles admin fallback)
    const result = await getEstablishmentForUser(supabase, dbUser);

    if (!result) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Update the establishment
    const updateData: Record<string, unknown> = {};
    if (description !== undefined) updateData.description = description;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website;
    if (dogFeatures !== undefined) updateData.dog_features = dogFeatures;
    if (openingHours !== undefined) updateData.opening_hours = openingHours;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('establishments')
      .update(updateData)
      .eq('id', result.establishmentId)
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

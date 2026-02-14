import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface ListingRequestBody {
  businessName: string;
  category: string;
  address: string;
  city: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  description?: string;
  websiteUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body: ListingRequestBody = await request.json();

    // Validate required fields
    if (!body.businessName || !body.address || !body.city || !body.contactName || !body.contactEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create user record
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
          name: user.user_metadata?.name || body.contactName,
        })
        .select('id')
        .single();
      dbUser = newUser;
    }

    if (!dbUser) {
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    // Create a new Establishment with PENDING status
    const { data: establishment, error: estError } = await supabase
      .from('Establishment')
      .insert({
        name: body.businessName,
        slug: body.businessName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, ''),
        description: body.description || `${body.businessName} - Pending verification`,
        categorySlug: body.category,
        cityId: body.city,
        address: body.address,
        phone: body.contactPhone || null,
        website: body.websiteUrl || null,
        latitude: 0,
        longitude: 0,
        rating: 0,
        reviewCount: 0,
        isFeatured: false,
        isVerified: false,
        status: 'PENDING',
        images: [],
        dogFeatures: {
          waterBowl: false,
          treats: false,
          outdoorSeating: false,
          indoorAllowed: false,
          offLeashArea: false,
          fenced: false,
          dogMenu: false,
        },
        priceLevel: 2,
        neighborhood: '',
      })
      .select('id')
      .single();

    if (estError || !establishment) {
      return NextResponse.json(
        { error: 'Failed to create establishment: ' + (estError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Create BusinessClaim
    const { data: claim, error: claimError } = await supabase
      .from('BusinessClaim')
      .insert({
        userId: dbUser.id,
        establishmentId: establishment.id,
        businessName: body.businessName,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone || null,
        status: 'PENDING',
      })
      .select()
      .single();

    if (claimError) {
      return NextResponse.json(
        { error: 'Failed to create business claim: ' + claimError.message },
        { status: 500 }
      );
    }

    // Update user role to BUSINESS if not already
    await supabase
      .from('User')
      .update({ role: 'BUSINESS' })
      .eq('id', dbUser.id);

    return NextResponse.json(
      {
        success: true,
        message: 'Listing request submitted successfully',
        claim,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing listing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

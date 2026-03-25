import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendClaimConfirmation, sendNewClaimAdminAlert } from '@/lib/email';
import { searchPlace, getPhotoUrl } from '@/lib/google-places';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Non-claimable category slugs
const NON_CLAIMABLE = ['parks', 'beaches'];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Look up user in users table by supabase_id, then by email
  let { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser && user.email) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();
    dbUser = emailUser;
  }

  if (!dbUser) {
    return NextResponse.json({ claims: [] });
  }

  const { data: claims, error } = await supabase
    .from('business_claims')
    .select('*')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch establishment details for each claim
  const enrichedClaims = await Promise.all(
    (claims || []).map(async (claim: Record<string, unknown>) => {
      const { data: est } = await supabase
        .from('establishments')
        .select('name, slug, city_id, address, primary_image')
        .eq('id', claim.establishment_id)
        .single();
      return { ...claim, establishment: est };
    })
  );

  return NextResponse.json({ claims: enrichedClaims });
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const {
    establishmentId,
    businessName,
    contactName,
    contactEmail,
    contactPhone,
    verificationMethod,
    verificationDoc,
  } = await request.json();

  if (!establishmentId || !businessName || !contactName || !contactEmail) {
    return NextResponse.json(
      { error: 'Establishment ID, business name, contact name, and email are required' },
      { status: 400 }
    );
  }

  // Check if the establishment exists and its category is claimable
  const { data: establishment } = await supabase
    .from('establishments')
    .select('id, name, address, website, category_id, google_place_id, city_id')
    .eq('id', establishmentId)
    .single();

  if (!establishment) {
    return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
  }

  // Look up category slug to check if claimable
  const estCategoryId = (establishment as Record<string, unknown>).category_id as string;
  if (estCategoryId) {
    const { data: category } = await supabase
      .from('categories')
      .select('slug')
      .eq('id', estCategoryId)
      .single();

    if (category && NON_CLAIMABLE.includes(category.slug)) {
      return NextResponse.json(
        { error: 'Public spaces like parks and beaches cannot be claimed. These are community-maintained listings.' },
        { status: 400 }
      );
    }
  }

  // Check if already claimed (exclude rejected claims so users can re-submit)
  const { data: existingClaim } = await supabase
    .from('business_claims')
    .select('id, status')
    .eq('establishment_id', establishmentId)
    .in('status', ['APPROVED', 'PENDING'])
    .maybeSingle();

  if (existingClaim) {
    if (existingClaim.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'This business has already been claimed' },
        { status: 409 }
      );
    }
    if (existingClaim.status === 'PENDING') {
      return NextResponse.json(
        { error: 'A claim for this business is already pending review' },
        { status: 409 }
      );
    }
  }

  // Get or create user record in users table (check by supabase_id first, then email)
  let { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser && user.email) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('id, supabase_id')
      .eq('email', user.email)
      .single();

    if (emailUser) {
      if (!emailUser.supabase_id) {
        await supabaseAdmin
          .from('users')
          .update({ supabase_id: user.id })
          .eq('id', emailUser.id);
      }
      dbUser = emailUser;
    }
  }

  if (!dbUser) {
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        supabase_id: user.id,
        email: user.email || contactEmail,
        name: user.user_metadata?.name || contactName,
        role: 'BUSINESS',
      })
      .select('id')
      .single();

    if (userError) {
      console.error('Error creating user:', userError);
      return NextResponse.json({ error: `Failed to create user record: ${userError.message}` }, { status: 500 });
    }
    dbUser = newUser;
  } else {
    // Update role to BUSINESS
    await supabaseAdmin.from('users').update({ role: 'BUSINESS' }).eq('id', dbUser.id);
  }

  if (!dbUser) {
    return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
  }

  // Determine verification method based on email domain match
  let effectiveVerificationMethod = verificationMethod || 'other';
  const estWebsite = (establishment as Record<string, unknown>).website as string | undefined;
  if (contactEmail && estWebsite) {
    try {
      const websiteUrl = estWebsite.startsWith('http') ? estWebsite : `https://${estWebsite}`;
      const websiteDomain = new URL(websiteUrl).hostname.replace('www.', '');
      const emailDomain = contactEmail.split('@')[1]?.toLowerCase();
      if (emailDomain === websiteDomain) {
        effectiveVerificationMethod = 'domain_email_match';
      }
    } catch {
      // Invalid URL, continue with provided method
    }
  }

  // Google Places enrichment — if establishment doesn't already have a google_place_id
  const estRecord = establishment as Record<string, unknown>;
  if (!estRecord.google_place_id) {
    try {
      // Look up city name for better search query
      const { data: cityData } = await supabase
        .from('cities')
        .select('name')
        .eq('id', estRecord.city_id)
        .single();
      const cityName = cityData?.name || '';
      const searchQuery = `${estRecord.name} ${estRecord.address || ''} ${cityName}`;
      const placeResult = await searchPlace(searchQuery);

      if (placeResult) {
        const photoRefs = (placeResult.photos || []).slice(0, 5).map(p => p.name);
        const enrichmentUpdate: Record<string, unknown> = {
          google_place_id: placeResult.id,
          google_maps_url: placeResult.googleMapsUri || null,
          photo_refs: photoRefs,
        };

        if (photoRefs.length > 0) {
          enrichmentUpdate.primary_image = getPhotoUrl(photoRefs[0], 800);
        }
        if (placeResult.location?.latitude && placeResult.location?.longitude) {
          enrichmentUpdate.latitude = placeResult.location.latitude;
          enrichmentUpdate.longitude = placeResult.location.longitude;
        }

        await supabaseAdmin
          .from('establishments')
          .update(enrichmentUpdate)
          .eq('id', establishmentId);

        console.log(`Claim enrichment: matched "${estRecord.name}" → place_id: ${placeResult.id}`);
      }
    } catch (enrichError) {
      console.error('Google Places enrichment during claim (non-blocking):', enrichError);
    }
  }

  const { data: claim, error } = await supabaseAdmin
    .from('business_claims')
    .insert({
      user_id: dbUser.id,
      establishment_id: establishmentId,
      business_name: businessName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      verification_method: effectiveVerificationMethod,
      verification_notes: verificationDoc || null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email notifications (non-blocking)
  sendClaimConfirmation(contactEmail, businessName, claim.id).catch(() => {});
  sendNewClaimAdminAlert(businessName, contactName, contactEmail, effectiveVerificationMethod).catch(() => {});

  return NextResponse.json({ claim }, { status: 201 });
}

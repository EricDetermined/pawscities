import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendClaimConfirmation, sendNewClaimAdminAlert } from '@/lib/email';

// Non-claimable category slugs
const NON_CLAIMABLE = ['parks', 'beaches'];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Look up user in our User table by supabaseId, then by email
  let { data: dbUser } = await supabase
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser && user.email) {
    const { data: emailUser } = await supabase
      .from('User')
      .select('id')
      .eq('email', user.email)
      .single();
    dbUser = emailUser;
  }

  if (!dbUser) {
    return NextResponse.json({ claims: [] });
  }

  const { data: claims, error } = await supabase
    .from('BusinessClaim')
    .select('*')
    .eq('userId', dbUser.id)
    .order('createdAt', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch establishment details for each claim
  const enrichedClaims = await Promise.all(
    (claims || []).map(async (claim: Record<string, unknown>) => {
      const { data: est } = await supabase
        .from('Establishment')
        .select('name, slug, cityId, address, primaryImage')
        .eq('id', claim.establishmentId)
        .single();
      return { ...claim, establishment: est };
    })
  );

  return NextResponse.json({ claims: enrichedClaims });
}

export async function POST(request: NextRequest) {
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
    .from('Establishment')
    .select('id, website, categoryId')
    .eq('id', establishmentId)
    .single();

  if (!establishment) {
    return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
  }

  // Look up category slug to check if claimable
  const estCategoryId = (establishment as Record<string, unknown>).categoryId as string;
  if (estCategoryId) {
    const { data: category } = await supabase
      .from('Category')
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

  // Check if already claimed
  const { data: existingClaim } = await supabase
    .from('BusinessClaim')
    .select('id, status')
    .eq('establishmentId', establishmentId)
    .single();

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

  // Get or create user record in User table (check by supabaseId first, then email)
  let { data: dbUser } = await supabase
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser && user.email) {
    // Check by email - user may have signed up as consumer first
    const { data: emailUser } = await supabase
      .from('User')
      .select('id, supabaseId')
      .eq('email', user.email)
      .single();

    if (emailUser) {
      if (!emailUser.supabaseId) {
        await supabase
          .from('User')
          .update({ supabaseId: user.id })
          .eq('id', emailUser.id);
      }
      dbUser = emailUser;
    }
  }

  if (!dbUser) {
    const { data: newUser, error: userError } = await supabase
      .from('User')
      .insert({
        supabaseId: user.id,
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

  const { data: claim, error } = await supabase
    .from('BusinessClaim')
    .insert({
      userId: dbUser.id,
      establishmentId: establishmentId,
      businessName: businessName,
      contactName: contactName,
      contactEmail: contactEmail,
      contactPhone: contactPhone || null,
      verificationMethod: effectiveVerificationMethod,
      verificationNotes: verificationDoc || null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update user role to BUSINESS
  await supabase.from('User').update({ role: 'BUSINESS' }).eq('id', dbUser.id);

  // Send email notifications (non-blocking)
  sendClaimConfirmation(contactEmail, businessName, claim.id).catch(() => {});
  sendNewClaimAdminAlert(businessName, contactName, contactEmail, effectiveVerificationMethod).catch(() => {});

  return NextResponse.json({ claim }, { status: 201 });
}

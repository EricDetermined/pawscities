import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendClaimConfirmation, sendNewClaimAdminAlert } from '@/lib/email';

// Non-claimable category slugs
const NON_CLAIMABLE_SLUGS = ['parks', 'beaches'];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function GET() {
  try {
    const supabase = await createClient();

    const [citiesRes, categoriesRes] = await Promise.all([
      supabase.from('City').select('id, name, slug').order('name'),
      supabase.from('Category').select('id, name, slug').order('name'),
    ]);

    // Filter out non-claimable categories (parks, beaches) from the dropdown
    const claimableCategories = (categoriesRes.data || []).filter(
      (cat: { slug: string }) => !NON_CLAIMABLE_SLUGS.includes(cat.slug)
    );

    return NextResponse.json({
      cities: citiesRes.data || [],
      categories: claimableCategories,
    });
  } catch (error) {
    console.error('Error fetching form data:', error);
    return NextResponse.json({ error: 'Failed to load form data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { name, address, cityId, categoryId, description, phone, website, contactName, contactEmail } = body;

    if (!name || !address || !cityId || !categoryId || !contactName || !contactEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Handle "other" category - store null, admin will assign later
    const isOtherCategory = categoryId === 'other';
    const resolvedCategoryId = isOtherCategory ? null : categoryId;

    if (!isOtherCategory) {
      // Validate that the category is claimable (not a public space like parks/beaches)
      const { data: category } = await supabase
        .from('Category')
        .select('slug')
        .eq('id', categoryId)
        .single();

      if (!category) {
        return NextResponse.json({ error: 'Invalid category selected' }, { status: 400 });
      }

      if (NON_CLAIMABLE_SLUGS.includes(category.slug)) {
        return NextResponse.json(
          { error: 'Public spaces like parks and beaches cannot be claimed. These are community-maintained listings.' },
          { status: 400 }
        );
      }
    }

    // Generate unique slug
    let slug = generateSlug(name);
    const { data: existingSlugs } = await supabase
      .from('Establishment')
      .select('slug')
      .eq('cityId', cityId)
      .like('slug', `${slug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      slug = `${slug}-${existingSlugs.length + 1}`;
    }

    // Check if user exists in User table (by supabaseId first, then by email)
    let { data: existingUser } = await supabase
      .from('User')
      .select('id')
      .eq('supabaseId', user.id)
      .single();

    if (!existingUser && user.email) {
      // Check by email - user may have signed up as consumer first
      const { data: emailUser } = await supabase
        .from('User')
        .select('id, supabaseId')
        .eq('email', user.email)
        .single();

      if (emailUser) {
        // Link existing user record to this Supabase auth account if not already linked
        if (!emailUser.supabaseId) {
          await supabase
            .from('User')
            .update({ supabaseId: user.id })
            .eq('id', emailUser.id);
        }
        existingUser = emailUser;
      }
    }

    if (!existingUser) {
      const { data: newUser, error: userError } = await supabase
        .from('User')
        .insert({
          supabaseId: user.id,
          email: user.email || contactEmail,
          name: user.user_metadata?.name || contactName,
        })
        .select('id')
        .single();

      if (userError) {
        console.error('Error creating user:', userError);
        return NextResponse.json({ error: `Failed to create user profile: ${userError.message}` }, { status: 500 });
      }
      existingUser = newUser;
    }

    if (!existingUser) {
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    // Create the establishment
    const { data: establishment, error: estError } = await supabase
      .from('Establishment')
      .insert({
        name,
        slug,
        address,
        cityId,
        categoryId: resolvedCategoryId,
        description: isOtherCategory ? `[Other Category] ${description || ''}`.trim() : (description || null),
        status: 'PENDING_REVIEW',
        tier: 'FREE',
        isVerified: false,
        isFeatured: false,
        rating: 0,
        reviewCount: 0,
        priceLevel: 2,
      })
      .select('id')
      .single();

    if (estError) {
      console.error('Error creating establishment:', estError);
      return NextResponse.json({ error: 'Failed to create establishment' }, { status: 500 });
    }

    // Create the claim
    const { error: claimError } = await supabase
      .from('BusinessClaim')
      .insert({
        userId: existingUser.id,
        establishmentId: establishment.id,
        businessName: name,
        contactName: contactName,
        contactEmail: contactEmail,
        contactPhone: phone || null,
        verificationMethod: 'business_submission',
        status: 'PENDING',
      });

    if (claimError) {
      console.error('Error creating claim:', claimError);
      // Clean up: delete the establishment we just created
      await supabase.from('Establishment').delete().eq('id', establishment.id);
      return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
    }

    // Note: User role is managed at the application level, not in the User table

    // Send email notifications (non-blocking)
    sendClaimConfirmation(contactEmail, name, establishment.id).catch(() => {});
    sendNewClaimAdminAlert(name, contactName, contactEmail, 'business_submission').catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Your business has been submitted! We will review it and get back to you within 1-2 business days.',
      establishmentId: establishment.id,
    });
  } catch (error) {
    console.error('Error submitting business:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

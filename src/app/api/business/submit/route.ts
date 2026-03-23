import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendClaimConfirmation, sendNewClaimAdminAlert } from '@/lib/email';
import { searchPlace, getPhotoUrl } from '@/lib/google-places';

// Lazy initialization to ensure env vars are available in serverless context
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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
      supabase.from('cities').select('id, name, slug').order('name'),
      supabase.from('categories').select('id, name, slug').order('name'),
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
    const supabaseAdmin = getSupabaseAdmin();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { name, address, cityId, categoryId, description, phone, website: rawWebsite, contactName, contactEmail, dogFeatures } = body;
    // Normalize website URL - ensure https:// prefix
    const website = rawWebsite ? (rawWebsite.match(/^https?:\/\//) ? rawWebsite : `https://${rawWebsite}`) : '';

    if (!name || !address || !cityId || !categoryId || !contactName || !contactEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Handle "other" category - find or create an "Other" category
    const isOtherCategory = categoryId === 'other';
    let resolvedCategoryId = categoryId;

    if (isOtherCategory) {
      // Look up existing "Other" category, or create one
      let { data: otherCat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('slug', 'other')
        .single();

      if (!otherCat) {
        const { data: newCat, error: catError } = await supabaseAdmin
          .from('categories')
          .insert({ name: 'Other', slug: 'other', icon: '📋', sort_order: 99 })
          .select('id')
          .single();

        if (catError) {
          console.error('Error creating Other category:', catError);
          return NextResponse.json({ error: `Failed to create category: ${catError.message}` }, { status: 500 });
        }
        otherCat = newCat;
      }

      if (!otherCat) {
        return NextResponse.json({ error: 'Failed to resolve category' }, { status: 500 });
      }
      resolvedCategoryId = otherCat.id;
    }

    if (!isOtherCategory) {
      // Validate that the category is claimable (not a public space like parks/beaches)
      const { data: category } = await supabase
        .from('categories')
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
      .from('establishments')
      .select('slug')
      .eq('city_id', cityId)
      .like('slug', `${slug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      slug = `${slug}-${existingSlugs.length + 1}`;
    }

    // Check if user exists in users table (by supabase_id first, then by email)
    let { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_id', user.id)
      .single();

    if (!existingUser && user.email) {
      // Check by email - user may have signed up as consumer first
      const { data: emailUser } = await supabase
        .from('users')
        .select('id, supabase_id')
        .eq('email', user.email)
        .single();

      if (emailUser) {
        // Link existing user record to this Supabase auth account if not already linked
        if (!emailUser.supabase_id) {
          await supabaseAdmin
            .from('users')
            .update({ supabase_id: user.id })
            .eq('id', emailUser.id);
        }
        existingUser = emailUser;
      }
    }

    if (!existingUser) {
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
        return NextResponse.json({ error: `Failed to create user profile: ${userError.message}` }, { status: 500 });
      }
      existingUser = newUser;
    } else {
      // Update role to BUSINESS if not already
      await supabaseAdmin
        .from('users')
        .update({ role: 'BUSINESS' })
        .eq('id', existingUser.id);
    }

    if (!existingUser) {
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    // Create the establishment using admin client to bypass RLS
    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .insert({
        name,
        slug,
        address,
        city_id: cityId,
        category_id: resolvedCategoryId,
        description: isOtherCategory ? `[Other Category] ${description || ''}`.trim() : (description || null),
        status: 'PENDING_REVIEW',
        tier: 'free',
        is_verified: false,
        is_featured: false,
        rating: 0,
        review_count: 0,
        price_level: 2,
        ...(dogFeatures && Object.keys(dogFeatures).length > 0 && { dog_features: dogFeatures }),
      })
      .select('id')
      .single();

    if (estError) {
      console.error('Error creating establishment:', estError);
      return NextResponse.json({ error: `Failed to create establishment: ${estError.message}` }, { status: 500 });
    }

    // Google Places enrichment (non-blocking — don't fail submission if this errors)
    try {
      // Look up the city name for a better search query
      const { data: cityData } = await supabase
        .from('cities')
        .select('name')
        .eq('id', cityId)
        .single();
      const cityName = cityData?.name || '';

      const searchQuery = `${name} ${address} ${cityName}`;
      const placeResult = await searchPlace(searchQuery);

      if (placeResult) {
        const photoRefs = (placeResult.photos || []).slice(0, 5).map(p => p.name);
        const primaryImage = photoRefs.length > 0 ? getPhotoUrl(photoRefs[0], 800) : null;

        const enrichmentUpdate: Record<string, unknown> = {
          google_place_id: placeResult.id,
          google_maps_url: placeResult.googleMapsUri || null,
          photo_refs: photoRefs,
        };

        // Only set primary_image if we got a Google photo
        if (primaryImage) {
          enrichmentUpdate.primary_image = primaryImage;
        }

        // Add coordinates if available
        if (placeResult.location?.latitude && placeResult.location?.longitude) {
          enrichmentUpdate.latitude = placeResult.location.latitude;
          enrichmentUpdate.longitude = placeResult.location.longitude;
        }

        // Add phone/website from Google if not provided by user
        if (!phone && placeResult.internationalPhoneNumber) {
          enrichmentUpdate.phone = placeResult.internationalPhoneNumber;
        }
        if (!website && placeResult.websiteUri) {
          enrichmentUpdate.website = placeResult.websiteUri;
        }

        // Add rating data from Google
        if (placeResult.rating) {
          enrichmentUpdate.rating = placeResult.rating;
          enrichmentUpdate.review_count = placeResult.userRatingCount || 0;
        }

        await supabaseAdmin
          .from('establishments')
          .update(enrichmentUpdate)
          .eq('id', establishment.id);

        console.log(`Google Places enrichment: matched "${name}" → place_id: ${placeResult.id}, ${photoRefs.length} photos`);
      } else {
        console.log(`Google Places enrichment: no match found for "${name}"`);
      }
    } catch (enrichError) {
      // Log but don't fail the submission
      console.error('Google Places enrichment error (non-blocking):', enrichError);
    }

    // Create the claim
    const { error: claimError } = await supabaseAdmin
      .from('business_claims')
      .insert({
        user_id: existingUser.id,
        establishment_id: establishment.id,
        business_name: name,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: phone || null,
        verification_method: 'business_submission',
        status: 'PENDING',
      });

    if (claimError) {
      console.error('Error creating claim:', claimError);
      // Clean up: delete the establishment we just created
      await supabaseAdmin.from('establishments').delete().eq('id', establishment.id);
      return NextResponse.json({ error: `Failed to create claim: ${claimError.message}` }, { status: 500 });
    }

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

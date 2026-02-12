import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// GET: Return cities and categories for the form dropdowns
export async function GET() {
  try {
    const [citiesRes, categoriesRes] = await Promise.all([
      supabaseAdmin.from('cities').select('id, name, slug').order('name'),
      supabaseAdmin.from('categories').select('id, name, slug').order('name'),
    ]);

    return NextResponse.json({
      cities: citiesRes.data || [],
      categories: categoriesRes.data || [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load form data' }, { status: 500 });
  }
}

// POST: Create a new establishment + claim
export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      address,
      city_id,
      category_id,
      description,
      phone,
      website,
      contactName,
      contactEmail,
    } = body;

    // Validate required fields
    if (!name || !address || !city_id || !category_id) {
      return NextResponse.json(
        { error: 'Business name, address, city, and category are required' },
        { status: 400 }
      );
    }

    if (!contactName || !contactEmail) {
      return NextResponse.json(
        { error: 'Contact name and email are required' },
        { status: 400 }
      );
    }

    // Generate a unique slug
    let slug = generateSlug(name);
    const { data: existingSlugs } = await supabaseAdmin
      .from('establishments')
      .select('slug')
      .ilike('slug', `${slug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      slug = `${slug}-${existingSlugs.length + 1}`;
    }

    // Ensure user exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('supabase_id', user.id)
      .single();

    let userId = existingUser?.id;

    if (!userId) {
      const { data: newUser, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          supabase_id: user.id,
          email: user.email,
          role: 'BUSINESS',
        })
        .select('id')
        .single();

      if (userError) {
        return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
      }
      userId = newUser.id;
    }

    // Create the establishment
    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .insert({
        name,
        slug,
        address,
        city_id,
        category_id,
        description: description || null,
        phone: phone || null,
        website: website || null,
        status: 'pending_review',
        tier: 'free',
        is_verified: false,
        is_featured: false,
        source: 'business_submission',
        confidence: 1.0,
      })
      .select('id, name, slug, address')
      .single();

    if (estError) {
      console.error('Establishment creation error:', estError);
      return NextResponse.json(
        { error: 'Failed to create establishment: ' + estError.message },
        { status: 500 }
      );
    }

    // Create the claim
    const { error: claimError } = await supabaseAdmin
      .from('business_claims')
      .insert({
        user_id: userId,
        establishment_id: establishment.id,
        business_name: name,
        contact_name: contactName,
        contact_email: contactEmail,
        status: 'pending',
      });

    if (claimError) {
      console.error('Claim creation error:', claimError);
      // Clean up the establishment if claim fails
      await supabaseAdmin.from('establishments').delete().eq('id', establishment.id);
      return NextResponse.json(
        { error: 'Failed to create claim: ' + claimError.message },
        { status: 500 }
      );
    }

    // Update user role to BUSINESS if needed
    await supabaseAdmin
      .from('users')
      .update({ role: 'BUSINESS' })
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      message: 'Your business has been submitted! We will review it and get back to you within 1-2 business days.',
      establishment,
    });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
    const supabaseAdmin = getSupabaseAdmin();

    const [citiesRes, categoriesRes] = await Promise.all([
      supabaseAdmin.from('cities').select('id, name, slug').order('name'),
      supabaseAdmin.from('categories').select('id, name, slug').order('name'),
    ]);

    return NextResponse.json({
      cities: citiesRes.data || [],
      categories: categoriesRes.data || [],
    });
  } catch (error) {
    console.error('Error fetching form data:', error);
    return NextResponse.json({ error: 'Failed to load form data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { name, address, city_id, category_id, description, phone, website, contactName, contactEmail } = body;

    if (!name || !address || !city_id || !category_id || !contactName || !contactEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate unique slug
    let slug = generateSlug(name);
    const { data: existingSlugs } = await supabaseAdmin
      .from('establishments')
      .select('slug')
      .like('slug', `${slug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      slug = `${slug}-${existingSlugs.length + 1}`;
    }

    // Check if user exists in users table
    let { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('supabase_id', session.user.id)
      .single();

    if (!existingUser) {
      const { data: newUser, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          supabase_id: session.user.id,
          email: session.user.email,
          role: 'BUSINESS',
        })
        .select('id')
        .single();

      if (userError) {
        console.error('Error creating user:', userError);
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
      }
      existingUser = newUser;
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
        tier: 'FREE',
        is_verified: false,
        source: 'business_submission',
        confidence: 100,
      })
      .select('id')
      .single();

    if (estError) {
      console.error('Error creating establishment:', estError);
      return NextResponse.json({ error: 'Failed to create establishment' }, { status: 500 });
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
        status: 'pending',
      });

    if (claimError) {
      console.error('Error creating claim:', claimError);
      // Clean up: delete the establishment we just created
      await supabaseAdmin.from('establishments').delete().eq('id', establishment.id);
      return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
    }

    // Update user role to BUSINESS if not already
    await supabaseAdmin
      .from('users')
      .update({ role: 'BUSINESS' })
      .eq('id', existingUser.id);

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

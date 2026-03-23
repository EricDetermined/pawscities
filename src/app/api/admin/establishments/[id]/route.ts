import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;
    const establishmentId = params.id;

    const [estResult, categoriesResult] = await Promise.all([
      supabase
        .from('establishments')
        .select(`
          id,
          name,
          description,
          category_id,
          city_id,
          status,
          tier,
          rating,
          review_count,
          address,
          phone,
          email,
          website,
          opening_hours,
          primary_image,
          photo_refs,
          created_at,
          updated_at,
          cities(id, name),
          categories(id, name, slug)
        `)
        .eq('id', establishmentId)
        .single(),
      supabase
        .from('categories')
        .select('id, name, slug')
        .order('name'),
    ]);

    if (estResult.error) {
      return NextResponse.json(
        { error: 'Establishment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...estResult.data,
      allCategories: categoriesResult.data || [],
    });
  } catch (error) {
    console.error('Admin establishment GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch establishment' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;
    const establishmentId = params.id;
    const body = await request.json();

    const {
      name,
      description,
      category,
      cityId,
      status,
      tier,
      address,
      phone,
      email,
      website,
      hours,
      primaryImage,
      isVerified,
      isFeatured,
    } = body;

    // Build update object, only include provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category_id = category;
    if (cityId !== undefined) updateData.city_id = cityId;
    if (status !== undefined) updateData.status = status;
    if (tier !== undefined) updateData.tier = tier;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (hours !== undefined) updateData.opening_hours = hours;
    if (primaryImage !== undefined) updateData.primary_image = primaryImage;
    if (isVerified !== undefined) updateData.is_verified = isVerified;
    if (isFeatured !== undefined) updateData.is_featured = isFeatured;

    const { data: establishment, error: updateError } = await supabase
      .from('establishments')
      .update(updateData)
      .eq('id', establishmentId)
      .select();

    if (updateError) {
      throw new Error(`Failed to update establishment: ${updateError.message}`);
    }

    if (!establishment || establishment.length === 0) {
      return NextResponse.json(
        { error: 'Establishment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(establishment[0]);
  } catch (error) {
    console.error('Admin establishment PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update establishment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;
    const establishmentId = params.id;

    // Soft delete - set status to INACTIVE
    const { data: establishment, error: updateError } = await supabase
      .from('establishments')
      .update({
        status: 'INACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', establishmentId)
      .select();

    if (updateError) {
      throw new Error(`Failed to delete establishment: ${updateError.message}`);
    }

    if (!establishment || establishment.length === 0) {
      return NextResponse.json(
        { error: 'Establishment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Establishment deleted successfully (soft delete)',
      id: establishmentId,
    });
  } catch (error) {
    console.error('Admin establishment DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete establishment' },
      { status: 500 }
    );
  }
}

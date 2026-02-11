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

    const { data: establishment, error: estError } = await supabase
      .from('establishments')
      .select(`
        id,
        name,
        description,
        category,
        city_id,
        status,
        tier,
        rating,
        reviews_count,
        claimed_by,
        address,
        phone,
        email,
        website,
        hours,
        image_url,
        created_at,
        updated_at,
        cities(id, name)
      `)
      .eq('id', establishmentId)
      .single();

    if (estError) {
      return NextResponse.json(
        { error: 'Establishment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(establishment);
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
      city_id,
      status,
      tier,
      address,
      phone,
      email,
      website,
      hours,
      image_url,
    } = body;

    // Build update object, only include provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (city_id !== undefined) updateData.city_id = city_id;
    if (status !== undefined) updateData.status = status;
    if (tier !== undefined) updateData.tier = tier;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (hours !== undefined) updateData.hours = hours;
    if (image_url !== undefined) updateData.image_url = image_url;

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

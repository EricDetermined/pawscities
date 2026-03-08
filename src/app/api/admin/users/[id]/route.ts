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
    const userId = params.id;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('User')
      .select(`
        id,
        supabaseId,
        email,
        name,
        role,
        isSuspended,
        avatarUrl,
        createdAt,
        updatedAt
      `)
      .eq('id', userId)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get reviews count
    const { count: reviewsCount } = await supabase
      .from('Review')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId);

    // Get claims count
    const { count: claimsCount } = await supabase
      .from('BusinessClaim')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId);

    // Get favorites count
    const { count: favoritesCount } = await supabase
      .from('Favorite')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId);

    return NextResponse.json({
      user,
      stats: {
        reviewsCount: reviewsCount || 0,
        claimsCount: claimsCount || 0,
        favoritesCount: favoritesCount || 0,
      },
    });
  } catch (error) {
    console.error('Admin user GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;
    const userId = params.id;
    const body = await request.json();

    const { role, suspended } = body;

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (role !== undefined) {
      // Validate role
      const validRoles = ['USER', 'BUSINESS', 'ADMIN'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be USER, BUSINESS, or ADMIN' },
          { status: 400 }
        );
      }
      updateData.role = role;
    }

    if (suspended !== undefined) {
      updateData.isSuspended = suspended;
    }

    // Prevent updating yourself to prevent lockout
    if (authResult.dbUser?.id === userId && suspended === true) {
      return NextResponse.json(
        { error: 'Cannot suspend your own account' },
        { status: 400 }
      );
    }

    const { data: user, error: updateError } = await supabase
      .from('User')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    if (!user || user.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: user[0],
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Admin user PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

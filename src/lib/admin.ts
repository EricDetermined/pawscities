import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface AdminAuthResult {
  error: NextResponse | null;
  supabase: Awaited<ReturnType<typeof createClient>> | null;
  user: { id: string; email?: string } | null;
  dbUser: { id: string; supabaseId: string; email: string; role: string } | null;
}

/**
 * Validates that the current user is authenticated and has ADMIN role
 * Returns auth context or error response
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('id, supabase_id, email, role')
      .eq('supabase_id', user.id)
      .single();

    if (dbError || !dbUser) {
      return {
        error: NextResponse.json(
          { error: 'User record not found' },
          { status: 404 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    // Map snake_case DB columns to camelCase for internal use
    const mappedDbUser = {
      id: dbUser.id,
      supabaseId: dbUser.supabase_id,
      email: dbUser.email,
      role: dbUser.role,
    };

    if (mappedDbUser.role !== 'ADMIN') {
      return {
        error: NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    return {
      error: null,
      supabase,
      user,
      dbUser: mappedDbUser,
    };
  } catch (error) {
    console.error('Admin auth error:', error);
    return {
      error: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
      supabase: null,
      user: null,
      dbUser: null,
    };
  }
}

/**
 * Validates that the current user is authenticated and has BUSINESS or ADMIN role
 * Returns auth context or error response
 */
export async function requireBusinessOrAdmin(): Promise<AdminAuthResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    // Check User table first (PascalCase, used by business/consumer flows)
    const { data: appUser } = await supabase
      .from('User')
      .select('id, supabaseId, email, role')
      .eq('supabaseId', user.id)
      .single();

    if (appUser) {
      const mappedDbUser = {
        id: appUser.id,
        supabaseId: appUser.supabaseId,
        email: appUser.email,
        role: appUser.role,
      };

      if (mappedDbUser.role !== 'BUSINESS' && mappedDbUser.role !== 'ADMIN') {
        return {
          error: NextResponse.json(
            { error: 'Business or admin access required' },
            { status: 403 }
          ),
          supabase: null,
          user: null,
          dbUser: null,
        };
      }

      return {
        error: null,
        supabase,
        user,
        dbUser: mappedDbUser,
      };
    }

    // Fallback: check users table (snake_case, used by admin flows)
    const { data: adminUser } = await supabase
      .from('users')
      .select('id, supabase_id, email, role')
      .eq('supabase_id', user.id)
      .single();

    if (!adminUser) {
      return {
        error: NextResponse.json(
          { error: 'User record not found' },
          { status: 404 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    const mappedDbUser = {
      id: adminUser.id,
      supabaseId: adminUser.supabase_id,
      email: adminUser.email,
      role: adminUser.role,
    };

    if (mappedDbUser.role !== 'BUSINESS' && mappedDbUser.role !== 'ADMIN') {
      return {
        error: NextResponse.json(
          { error: 'Business or admin access required' },
          { status: 403 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    return {
      error: null,
      supabase,
      user,
      dbUser: mappedDbUser,
    };
  } catch (error) {
    console.error('Business/Admin auth error:', error);
    return {
      error: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
      supabase: null,
      user: null,
      dbUser: null,
    };
  }
}

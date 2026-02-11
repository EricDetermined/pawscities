import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface AdminAuthResult {
  error: NextResponse | null;
  supabase: ReturnType<typeof createClient> | null;
  user: { id: string; email?: string } | null;
  dbUser: { id: string; supabase_id: string; email: string; role: string; is_suspended: boolean } | null;
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
      .select('id, supabase_id, email, role, is_suspended')
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

    if (dbUser.is_suspended) {
      return {
        error: NextResponse.json(
          { error: 'Account is suspended' },
          { status: 403 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    if (dbUser.role !== 'ADMIN') {
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
      dbUser,
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

    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('id, supabase_id, email, role, is_suspended')
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

    if (dbUser.is_suspended) {
      return {
        error: NextResponse.json(
          { error: 'Account is suspended' },
          { status: 403 }
        ),
        supabase: null,
        user: null,
        dbUser: null,
      };
    }

    if (dbUser.role !== 'BUSINESS' && dbUser.role !== 'ADMIN') {
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
      dbUser,
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

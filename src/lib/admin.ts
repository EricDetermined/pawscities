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
 * Uses the `users` table (the only user table in the database)
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
 * All users are in the single `users` table with a `role` column
 * Users who sign up as consumers have role USER, and get upgraded to BUSINESS when they claim
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

    // Look up user by supabase_id first, then by email
    let { data: dbUser } = await supabase
      .from('users')
      .select('id, supabase_id, email, role')
      .eq('supabase_id', user.id)
      .single();

    if (!dbUser && user.email) {
      const { data: emailUser } = await supabase
        .from('users')
        .select('id, supabase_id, email, role')
        .eq('email', user.email)
        .single();

      if (emailUser) {
        // Link supabase_id if not already linked
        if (!emailUser.supabase_id) {
          await supabase
            .from('users')
            .update({ supabase_id: user.id })
            .eq('id', emailUser.id);
        }
        dbUser = emailUser;
      }
    }

    if (!dbUser) {
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
      id: dbUser.id,
      supabaseId: dbUser.supabase_id,
      email: dbUser.email,
      role: dbUser.role,
    };

    // Allow BUSINESS and ADMIN roles
    if (mappedDbUser.role !== 'BUSINESS' && mappedDbUser.role !== 'ADMIN') {
      // Also check if user has any business claims (pending or approved) - they may not have
      // been upgraded to BUSINESS role yet
      const { data: claim } = await supabase
        .from('business_claims')
        .select('id')
        .eq('user_id', dbUser.id)
        .in('status', ['APPROVED', 'PENDING'])
        .limit(1)
        .single();

      if (claim) {
        // Upgrade role to BUSINESS since they have a claim
        await supabase.from('users').update({ role: 'BUSINESS' }).eq('id', dbUser.id);
        mappedDbUser.role = 'BUSINESS';
      } else {
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

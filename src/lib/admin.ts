import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabaseServiceRole() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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

    // If no users record found, this might be a new business contact logging in for the first time
    // Check if there's a business claim with their email as contact_email
    if (!dbUser && user.email) {
      const supabaseAdmin = getSupabaseServiceRole();

      // Check for approved claims where this email is the contact
      const { data: claimByContact } = await supabaseAdmin
        .from('business_claims')
        .select('id, user_id, establishment_id, business_name')
        .eq('contact_email', user.email)
        .eq('status', 'APPROVED')
        .limit(1)
        .single();

      if (claimByContact) {
        // Create a users record for this business contact
        const { data: newUser } = await supabaseAdmin
          .from('users')
          .insert({
            supabase_id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email.split('@')[0],
            role: 'BUSINESS',
          })
          .select('id, supabase_id, email, role')
          .single();

        if (newUser) {
          // Link this new user to the existing claim
          await supabaseAdmin
            .from('business_claims')
            .update({ user_id: newUser.id })
            .eq('id', claimByContact.id);

          // Also update the establishment's claimed_by
          await supabaseAdmin
            .from('establishments')
            .update({ claimed_by: newUser.id })
            .eq('id', claimByContact.establishment_id);

          dbUser = newUser;
          console.log(`Linked business contact ${user.email} to claim ${claimByContact.id}`);
        }
      }
    }

    if (!dbUser) {
      return {
        error: NextResponse.json(
          { error: 'User record not found. If you are a business contact, please check that your claim has been approved.' },
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
      // Check if user has any business claims by user_id OR by contact_email
      const { data: claimById } = await supabase
        .from('business_claims')
        .select('id')
        .eq('user_id', dbUser.id)
        .in('status', ['APPROVED', 'PENDING'])
        .limit(1)
        .single();

      let hasClaim = !!claimById;

      if (!hasClaim && dbUser.email) {
        const { data: claimByEmail } = await supabase
          .from('business_claims')
          .select('id, user_id')
          .eq('contact_email', dbUser.email)
          .eq('status', 'APPROVED')
          .limit(1)
          .single();

        if (claimByEmail) {
          hasClaim = true;
          // Link the claim to this user if it's not already
          if (claimByEmail.user_id !== dbUser.id) {
            const supabaseAdmin = getSupabaseServiceRole();
            await supabaseAdmin
              .from('business_claims')
              .update({ user_id: dbUser.id })
              .eq('id', claimByEmail.id);
          }
        }
      }

      if (hasClaim) {
        // Upgrade role to BUSINESS
        const supabaseAdmin = getSupabaseServiceRole();
        await supabaseAdmin.from('users').update({ role: 'BUSINESS' }).eq('id', dbUser.id);
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

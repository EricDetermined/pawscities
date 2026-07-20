import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/** Service-role client for community reads that join across users/dogs safely. */
export function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface CommunityUser {
  id: string;
  supabaseId: string;
}

/**
 * Resolves the current session to the internal users.id.
 * Creates the users row on first touch (same pattern as /api/dogs).
 * Returns null when not authenticated.
 */
export async function getCurrentDbUser(): Promise<CommunityUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getServiceClient();
  const { data: dbUser } = await admin
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (dbUser) return { id: dbUser.id, supabaseId: user.id };

  const { data: newUser } = await admin
    .from('users')
    .insert({
      supabase_id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Dog Lover',
    })
    .select('id')
    .single();

  return newUser ? { id: newUser.id, supabaseId: user.id } : null;
}

/** Fields of a user that are safe to expose publicly. */
export const PUBLIC_USER_FIELDS = 'id, name, avatar, home_city';

/** Fields of a public dog profile that are safe to expose publicly. */
export const PUBLIC_DOG_FIELDS =
  'id, slug, name, breed, birth_date, size, personality, bio, photo, photos, is_public, created_at, user_id';

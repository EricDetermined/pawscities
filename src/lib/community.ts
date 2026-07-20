import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
 * Extras applied when a users row is first created: home city collected at
 * signup (stored in auth metadata as a slug) and ambassador referral
 * attribution (metadata from signup, falling back to the pc_ref cookie).
 */
export async function resolveSignupExtras(
  admin: ReturnType<typeof getServiceClient>,
  metadata: Record<string, any> | undefined
): Promise<{ home_city?: string; referred_by?: string }> {
  const extras: { home_city?: string; referred_by?: string } = {};

  const citySlug = metadata?.home_city_slug;
  if (citySlug && typeof citySlug === 'string') {
    const { data: city } = await admin
      .from('cities')
      .select('id')
      .eq('slug', citySlug)
      .maybeSingle();
    if (city) extras.home_city = city.id;
  }

  let ref = metadata?.referred_by;
  if (!ref) {
    try {
      const cookieStore = await cookies();
      ref = cookieStore.get('pc_ref')?.value;
    } catch {
      // cookies() unavailable outside a request context
    }
  }
  if (ref && typeof ref === 'string') {
    extras.referred_by = ref.slice(0, 50);
  }

  return extras;
}

/**
 * Resolves the current session to the internal users.id.
 * Creates the users row on first touch (same pattern as /api/dogs),
 * applying signup extras (home city, referral) when it does.
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

  const extras = await resolveSignupExtras(admin, user.user_metadata);
  const { data: newUser } = await admin
    .from('users')
    .insert({
      supabase_id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Dog Lover',
      avatar: user.user_metadata?.avatar_url,
      ...extras,
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

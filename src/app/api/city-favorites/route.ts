import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { CITIES } from '@/lib/cities-config';

// City favorites (2026-09-04 heuristic eval): heart/save whole cities.

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getDbUserId(supabase: Awaited<ReturnType<typeof createClient>>, supabaseId: string, email?: string | null, name?: string | null) {
  const { data: dbUser } = await supabase.from('users').select('id').eq('supabase_id', supabaseId).single();
  if (dbUser) return dbUser.id as string;
  const { data: newUser } = await getSupabaseAdmin()
    .from('users')
    .insert({ supabase_id: supabaseId, email: email || '', name: name || email?.split('@')[0] || 'Dog Lover' })
    .select('id')
    .single();
  return (newUser?.id as string) || null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ cities: [] });
  const { data: dbUser } = await supabase.from('users').select('id').eq('supabase_id', user.id).single();
  if (!dbUser) return NextResponse.json({ cities: [] });
  const { data } = await supabase.from('city_favorites').select('city_slug').eq('user_id', dbUser.id);
  return NextResponse.json({ cities: (data || []).map(r => r.city_slug) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { citySlug } = await request.json();
  if (!citySlug || !CITIES[citySlug]) {
    return NextResponse.json({ error: 'Valid citySlug is required' }, { status: 400 });
  }
  const userId = await getDbUserId(supabase, user.id, user.email, user.user_metadata?.name);
  if (!userId) return NextResponse.json({ error: 'User record unavailable' }, { status: 500 });

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('city_favorites').select('id').eq('user_id', userId).eq('city_slug', citySlug).maybeSingle();
  if (existing) {
    await admin.from('city_favorites').delete().eq('id', existing.id);
    return NextResponse.json({ favorited: false });
  }
  await admin.from('city_favorites').insert({ user_id: userId, city_slug: citySlug });
  return NextResponse.json({ favorited: true });
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/community';

/**
 * GET /api/ambassadors/stats
 * The logged-in ambassador's referral code, share link, and impact stats.
 * Matches the ambassador application by the account's email.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admin = getServiceClient();
  const { data: application } = await admin
    .from('ambassador_applications')
    .select('id, full_name, city, status, tier, referral_code')
    .ilike('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ ambassador: null });
  }

  if (application.status !== 'approved' || !application.referral_code) {
    return NextResponse.json({
      ambassador: {
        name: application.full_name,
        city: application.city,
        status: application.status,
        tier: application.tier,
      },
    });
  }

  const code = application.referral_code;
  const [users, subscribers, claims, establishments] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }).eq('referred_by', code),
    admin.from('subscribers').select('id', { count: 'exact', head: true }).eq('referred_by', code),
    admin.from('business_claims').select('id', { count: 'exact', head: true }).eq('referred_by', code),
    admin.from('establishments').select('id', { count: 'exact', head: true }).eq('referred_by', code),
  ]);

  // City slug for a localized share link, when the ambassador's city matches one of ours
  const { data: cities } = await admin.from('cities').select('slug, name').eq('is_active', true);
  const cityMatch = (cities || []).find(
    c => c.name.toLowerCase() === (application.city || '').toLowerCase()
  );

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
  const shareUrl = cityMatch
    ? `${baseUrl}/${cityMatch.slug}?ref=${code}`
    : `${baseUrl}/?ref=${code}`;

  return NextResponse.json({
    ambassador: {
      name: application.full_name,
      city: application.city,
      citySlug: cityMatch?.slug || null,
      status: application.status,
      tier: application.tier,
      referralCode: code,
      shareUrl,
    },
    stats: {
      members: users.count ?? 0,
      subscribers: subscribers.count ?? 0,
      businessClaims: claims.count ?? 0,
      businessesLive: establishments.count ?? 0,
    },
  });
}

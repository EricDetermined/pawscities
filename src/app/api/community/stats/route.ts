export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/community';

/**
 * GET /api/community/stats
 * Public aggregate community metrics (no personal data — counts only).
 * Powers the weekly community pulse report and future public stat widgets.
 */
export async function GET() {
  const admin = getServiceClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const today = now.toISOString().split('T')[0];

  const count = (q: PromiseLike<{ count: number | null }>) =>
    Promise.resolve(q).then(r => r.count ?? 0);

  const [
    membersTotal, membersWeek,
    dogsPublic, dogsWeek,
    followsTotal, followsWeek,
    packsTotal, packsWeek,
    checkinsTotal, checkinsWeek,
    reviewsTotal, reviewsWeek,
    subscribersTotal, subscribersWeek,
    eventsUpcoming, eventsPendingReview,
  ] = await Promise.all([
    count(admin.from('users').select('id', { count: 'exact', head: true })),
    count(admin.from('users').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)),
    count(admin.from('dog_profiles').select('id', { count: 'exact', head: true }).eq('is_public', true)),
    count(admin.from('dog_profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)),
    count(admin.from('follows').select('id', { count: 'exact', head: true })),
    count(admin.from('follows').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)),
    count(admin.from('pack_links').select('id', { count: 'exact', head: true }).eq('status', 'accepted')),
    count(admin.from('pack_links').select('id', { count: 'exact', head: true }).eq('status', 'accepted').gte('created_at', weekAgo)),
    count(admin.from('check_ins').select('id', { count: 'exact', head: true })),
    count(admin.from('check_ins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)),
    count(admin.from('reviews').select('id', { count: 'exact', head: true })),
    count(admin.from('reviews').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)),
    count(admin.from('subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    count(admin.from('subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', weekAgo)),
    count(admin.from('events').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('start_date', today)),
    count(admin.from('events').select('id', { count: 'exact', head: true }).eq('status', 'PENDING')),
  ]);

  // Members by city (home_city set)
  const [{ data: cities }, { data: usersByCity }] = await Promise.all([
    admin.from('cities').select('id, slug, name').eq('is_active', true),
    admin.from('users').select('home_city').not('home_city', 'is', null),
  ]);
  const cityName = new Map((cities || []).map(c => [c.id, c.name]));
  const membersByCity: Record<string, number> = {};
  for (const u of usersByCity || []) {
    const name = cityName.get(u.home_city);
    if (name) membersByCity[name] = (membersByCity[name] || 0) + 1;
  }

  // Ambassador attribution (aggregate counts per referral code)
  const { data: ambassadors } = await admin
    .from('ambassador_applications')
    .select('full_name, city, referral_code')
    .eq('status', 'approved')
    .not('referral_code', 'is', null);

  const ambassadorStats = await Promise.all(
    (ambassadors || []).map(async a => {
      const [members, subs, claims] = await Promise.all([
        count(admin.from('users').select('id', { count: 'exact', head: true }).eq('referred_by', a.referral_code)),
        count(admin.from('subscribers').select('id', { count: 'exact', head: true }).eq('referred_by', a.referral_code)),
        count(admin.from('business_claims').select('id', { count: 'exact', head: true }).eq('referred_by', a.referral_code)),
      ]);
      return {
        // First name only — aggregate, no contact details
        name: (a.full_name || '').split(' ')[0],
        city: a.city,
        members,
        subscribers: subs,
        businessClaims: claims,
      };
    })
  );

  return NextResponse.json(
    {
      generatedAt: now.toISOString(),
      totals: {
        members: membersTotal,
        publicDogs: dogsPublic,
        follows: followsTotal,
        packs: packsTotal,
        checkIns: checkinsTotal,
        reviews: reviewsTotal,
        subscribers: subscribersTotal,
        upcomingEvents: eventsUpcoming,
        eventsPendingReview,
      },
      last7Days: {
        newMembers: membersWeek,
        newDogs: dogsWeek,
        newFollows: followsWeek,
        newPacks: packsWeek,
        checkIns: checkinsWeek,
        reviews: reviewsWeek,
        newSubscribers: subscribersWeek,
      },
      membersByCity,
      ambassadors: ambassadorStats,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
  );
}

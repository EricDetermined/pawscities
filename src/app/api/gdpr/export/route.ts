import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const [dogs, reviews, favorites, checkins, activities] = await Promise.all([
    supabase.from('dog_profiles').select('*').eq('user_id', dbUser.id),
    supabase.from('reviews').select('*').eq('user_id', dbUser.id),
    supabase.from('favorites').select('*, establishments:establishment_id(name, slug)').eq('user_id', dbUser.id),
    supabase.from('check_ins').select('*, establishments:establishment_id(name, slug)').eq('user_id', dbUser.id),
    supabase.from('activities').select('*').eq('user_id', dbUser.id),
  ]);

  const exportData = {
    exportDate: new Date().toISOString(),
    gdprArticle: 'Article 20 - Right to Data Portability',
    user: {
      email: dbUser.email,
      name: dbUser.name,
      language: dbUser.language,
      homeCity: dbUser.home_city,
      role: dbUser.role,
      createdAt: dbUser.created_at,
    },
    dogs: dogs.data || [],
    reviews: reviews.data || [],
    favorites: favorites.data || [],
    checkIns: checkins.data || [],
    activities: activities.data || [],
    summary: {
      totalDogs: dogs.data?.length || 0,
      totalReviews: reviews.data?.length || 0,
      totalFavorites: favorites.data?.length || 0,
      totalCheckIns: checkins.data?.length || 0,
      totalActivities: activities.data?.length || 0,
    },
  };

  const filename = `pawcities-data-export-${new Date().toISOString().split('T')[0]}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { confirmation } = await request.json();
  if (confirmation !== 'DELETE_MY_ACCOUNT') {
    return NextResponse.json({
      error: 'Please confirm deletion by sending { "confirmation": "DELETE_MY_ACCOUNT" }'
    }, { status: 400 });
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await supabase
    .from('reviews')
    .update({
      title: '[Deleted]',
      content: 'This review was removed by the user.',
      dog_names: null,
      review_photos: [],
    })
    .eq('user_id', dbUser.id);

  await Promise.all([
    supabase.from('dog_profiles').delete().eq('user_id', dbUser.id),
    supabase.from('favorites').delete().eq('user_id', dbUser.id),
    supabase.from('check_ins').delete().eq('user_id', dbUser.id),
    supabase.from('activities').delete().eq('user_id', dbUser.id),
    supabase.from('business_claims').delete().eq('user_id', dbUser.id),
  ]);

  await supabase
    .from('users')
    .update({
      email: `deleted-${dbUser.id}@deleted.pawcities.com`,
      name: 'Deleted User',
      avatar: null,
      home_city: null,
    })
    .eq('id', dbUser.id);

  return NextResponse.json({
    message: 'Account deletion initiated',
    details: 'Your personal data has been anonymized. Reviews are retained in anonymized form per our data retention policy. You may contact support@pawcities.com for complete erasure.',
    gdprArticle: 'Article 17 - Right to Erasure',
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('email, name, created_at')
    .eq('supabase_id', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isDeleted = dbUser.email.startsWith('deleted-');

  return NextResponse.json({
    status: isDeleted ? 'deleted' : 'active',
    message: isDeleted
      ? 'Your account has been deleted and data anonymized.'
      : 'Your account is active. To delete, send a POST request with confirmation.',
  });
}

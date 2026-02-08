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
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await supabase
    .from('Review')
    .update({
      title: '[Deleted]',
      content: 'This review was removed by the user.',
      dogNames: null,
      reviewPhotos: [],
    })
    .eq('userId', dbUser.id);

  await Promise.all([
    supabase.from('DogProfile').delete().eq('userId', dbUser.id),
    supabase.from('Favorite').delete().eq('userId', dbUser.id),
    supabase.from('CheckIn').delete().eq('userId', dbUser.id),
    supabase.from('Activity').delete().eq('userId', dbUser.id),
    supabase.from('BusinessClaim').delete().eq('userId', dbUser.id),
  ]);

  await supabase
    .from('User')
    .update({
      email: `deleted-${dbUser.id}@deleted.pawscities.com`,
      name: 'Deleted User',
      avatar: null,
      homeCity: null,
    })
    .eq('id', dbUser.id);

  return NextResponse.json({
    message: 'Account deletion initiated',
    details: 'Your personal data has been anonymized. Reviews are retained in anonymized form per our data retention policy. You may contact support@pawscities.com for complete erasure.',
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
    .from('User')
    .select('email, name, createdAt')
    .eq('supabaseId', user.id)
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

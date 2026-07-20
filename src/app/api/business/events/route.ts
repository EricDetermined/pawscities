export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getBusinessContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Authentication required', status: 401 } as const;

  const admin = getSupabaseAdmin();
  const { data: dbUser } = await admin
    .from('users')
    .select('id, email, name')
    .eq('supabase_id', user.id)
    .single();
  if (!dbUser) return { error: 'User not found', status: 404 } as const;

  const { data: claim } = await admin
    .from('business_claims')
    .select('establishment_id')
    .eq('user_id', dbUser.id)
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!claim) return { error: 'No approved business claim found', status: 403 } as const;

  const { data: establishment } = await admin
    .from('establishments')
    .select('id, name, address, city_id')
    .eq('id', claim.establishment_id)
    .single();
  if (!establishment) return { error: 'Establishment not found', status: 404 } as const;

  const { data: city } = await admin
    .from('cities')
    .select('id, slug, name')
    .eq('id', establishment.city_id)
    .single();

  return { admin, dbUser, establishment, city } as const;
}

/** GET /api/business/events — the claimed establishment + this business's submitted events */
export async function GET() {
  const ctx = await getBusinessContext();
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { admin, dbUser, establishment, city } = ctx;

  const { data: events, error } = await admin
    .from('events')
    .select('id, name, description, start_date, start_time, end_time, venue_name, external_url, status, is_free, created_at')
    .eq('submitted_by', dbUser.id)
    .order('start_date', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    establishment: {
      id: establishment.id,
      name: establishment.name,
      address: establishment.address,
      city: city ? { slug: city.slug, name: city.name } : null,
    },
    events: events || [],
  });
}

/** POST /api/business/events — create an event at the claimed establishment (goes to admin review) */
export async function POST(request: NextRequest) {
  const ctx = await getBusinessContext();
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { admin, dbUser, establishment, city } = ctx;
  const body = await request.json();
  const { name, description, startDate, startTime, endTime, externalUrl, isFree } = body;

  if (!name || !startDate) {
    return NextResponse.json({ error: 'Event name and date are required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  if (startDate < today) {
    return NextResponse.json({ error: 'Event date cannot be in the past' }, { status: 400 });
  }

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 200) +
    '-' +
    startDate;

  const { data: event, error } = await admin
    .from('events')
    .insert({
      slug,
      city_id: establishment.city_id,
      name: String(name).substring(0, 500),
      description: description ? String(description).substring(0, 5000) : null,
      venue_name: establishment.name,
      venue_address: establishment.address,
      establishment_id: establishment.id,
      external_url: externalUrl || null,
      start_date: startDate,
      start_time: startTime || null,
      end_time: endTime || null,
      tags: ['business'],
      status: 'PENDING',
      source: 'business',
      submitted_by: dbUser.id,
      submitter_name: dbUser.name || establishment.name,
      submitter_email: dbUser.email,
      is_free: isFree !== false,
    })
    .select('id, name, start_date, status')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { event, message: `Event submitted for review — it will appear on the ${city?.name || ''} page once approved.` },
    { status: 201 }
  );
}

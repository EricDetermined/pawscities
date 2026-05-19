import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase Admin (service role for subscriber writes) ──────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

// ─── POST: Subscribe an email ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, citySlug, source } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('[SUBSCRIBE] Supabase not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Check if subscriber already exists (case-insensitive email match)
    const { data: existing } = await supabase
      .from('subscribers')
      .select('id, status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json({ message: 'Already subscribed!', alreadySubscribed: true });
      }
      // Re-subscribe (was previously unsubscribed or bounced)
      const result = await supabase
        .from('subscribers')
        .update({
          status: 'active',
          name: name?.trim() || null,
          city_slug: citySlug || null,
          source: source || 'website',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unsubscribed_at: null,
        })
        .eq('id', existing.id)
        .select('id, email, city_slug')
        .single();
      data = result.data;
      error = result.error;
    } else {
      // New subscriber
      const result = await supabase
        .from('subscribers')
        .insert({
          email: normalizedEmail,
          name: name?.trim() || null,
          city_slug: citySlug || null,
          source: source || 'website',
          status: 'active',
          confirmed_at: new Date().toISOString(),
        })
        .select('id, email, city_slug')
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('[SUBSCRIBE] Database error:', error);
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
    }

    console.log(`[SUBSCRIBE] New subscriber: ${normalizedEmail} (city: ${citySlug || 'none'}, source: ${source || 'website'})`);

    return NextResponse.json({
      message: 'Welcome to Paw Cities! You\'ll receive our weekly digest with the best dog-friendly events and places.',
      subscriber: { id: data.id, email: data.email, citySlug: data.city_slug },
    });
  } catch (err) {
    console.error('[SUBSCRIBE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET: Unsubscribe via token ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('unsubscribe');

  if (!token) {
    return NextResponse.json({ error: 'Missing unsubscribe token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { error } = await supabase
    .from('subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('unsubscribe_token', token);

  if (error) {
    console.error('[UNSUBSCRIBE] Error:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }

  // Redirect to a friendly unsubscribe confirmation page
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
  return NextResponse.redirect(`${baseUrl}/?unsubscribed=true`);
}

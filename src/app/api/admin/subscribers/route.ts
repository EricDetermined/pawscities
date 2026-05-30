export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    // Fetch all subscribers
    const { data: subscribers, error } = await supabase
      .from('subscribers')
      .select('id, email, name, city_slug, source, status, created_at, confirmed_at, unsubscribed_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[SUBSCRIBERS] Fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const all = subscribers || [];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const stats = {
      total: all.length,
      active: all.filter(s => s.status === 'active').length,
      unsubscribed: all.filter(s => s.status === 'unsubscribed').length,
      thisWeek: all.filter(s => s.status === 'active' && s.created_at >= oneWeekAgo).length,
    };

    return NextResponse.json({ subscribers: all, stats });
  } catch (err) {
    console.error('[SUBSCRIBERS] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

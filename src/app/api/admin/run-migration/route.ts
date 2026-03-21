import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Run database migrations via API
 * Protected by CRON_SECRET
 * GET /api/admin/run-migration?secret=CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: { step: string; success: boolean; error?: string }[] = [];

  // Migration 004: Social engagement metrics
  const migration004Steps = [
    `ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0`,
    `ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0`,
    `ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS reach integer DEFAULT 0`,
    `ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS impressions integer DEFAULT 0`,
    `ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS saves integer DEFAULT 0`,
    `ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS engagement_score numeric DEFAULT 0`,
    `ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS insights_updated_at timestamptz`,
    `CREATE TABLE IF NOT EXISTS social_comments (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      comment_id text UNIQUE NOT NULL,
      post_id text NOT NULL,
      username text NOT NULL,
      text text NOT NULL,
      commented_at timestamptz NOT NULL,
      replied boolean DEFAULT false,
      reply_text text,
      replied_at timestamptz,
      sentiment text,
      created_at timestamptz DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_comments(post_id)`,
    `CREATE INDEX IF NOT EXISTS idx_social_comments_unreplied ON social_comments(replied) WHERE replied = false`,
    `ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY IF NOT EXISTS "Service role can manage social comments" ON social_comments FOR ALL USING (true) WITH CHECK (true)`,
  ];

  // Migration 005: Social outreach
  const migration005Steps = [
    `CREATE TABLE IF NOT EXISTS social_watchlist (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      type text NOT NULL CHECK (type IN ('account', 'hashtag')),
      username text,
      hashtag text,
      relationship text DEFAULT 'peer',
      notes text,
      active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_social_watchlist_type ON social_watchlist(type)`,
    `CREATE INDEX IF NOT EXISTS idx_social_watchlist_active ON social_watchlist(active)`,
    `CREATE TABLE IF NOT EXISTS social_opportunities (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      media_id text UNIQUE NOT NULL,
      hashtag text,
      source_username text,
      permalink text NOT NULL,
      caption text,
      likes integer DEFAULT 0,
      comments integer DEFAULT 0,
      media_type text,
      category text DEFAULT 'general',
      suggested_reply text,
      status text DEFAULT 'new' CHECK (status IN ('new', 'engaged', 'skipped', 'expired')),
      engaged_at timestamptz,
      actual_reply text,
      posted_at timestamptz,
      created_at timestamptz DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_social_opportunities_status ON social_opportunities(status)`,
    `CREATE INDEX IF NOT EXISTS idx_social_opportunities_category ON social_opportunities(category)`,
    `CREATE INDEX IF NOT EXISTS idx_social_opportunities_posted ON social_opportunities(posted_at DESC)`,
    `ALTER TABLE social_watchlist ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE social_opportunities ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY IF NOT EXISTS "Service role can manage social watchlist" ON social_watchlist FOR ALL USING (true) WITH CHECK (true)`,
    `CREATE POLICY IF NOT EXISTS "Service role can manage social opportunities" ON social_opportunities FOR ALL USING (true) WITH CHECK (true)`,
  ];

  // Run all migrations
  const allSteps = [...migration004Steps, ...migration005Steps];
  for (const sql of allSteps) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      if (error) {
        // Try direct approach if rpc doesn't exist
        const { error: directError } = await supabase.from('_migrations_temp').select().limit(0);
        results.push({ step: sql.substring(0, 80) + '...', success: false, error: error.message });
      } else {
        results.push({ step: sql.substring(0, 80) + '...', success: true });
      }
    } catch (e) {
      results.push({ step: sql.substring(0, 80) + '...', success: false, error: String(e) });
    }
  }

  // Seed watchlist data
  try {
    await supabase.from('social_watchlist').upsert([
      { type: 'account', username: 'dogfriendlylondon', relationship: 'peer', notes: 'Dog-friendly London guide' },
      { type: 'account', username: 'dogfriendlyparis', relationship: 'peer', notes: 'Dog-friendly Paris content' },
      { type: 'account', username: 'bringfido', relationship: 'competitor', notes: 'Major pet travel platform' },
      { type: 'account', username: 'dogvacay', relationship: 'competitor', notes: 'Dog travel content' },
      { type: 'account', username: 'thebarklondon', relationship: 'business', notes: 'Dog-friendly venue in London' },
      { type: 'hashtag', hashtag: 'dogfriendlygeneva', notes: 'Local Geneva content' },
      { type: 'hashtag', hashtag: 'dogfriendlybarcelona', notes: 'Local Barcelona content' },
      { type: 'hashtag', hashtag: 'dogfriendlytokyo', notes: 'Local Tokyo content' },
      { type: 'hashtag', hashtag: 'dogfriendlysydney', notes: 'Local Sydney content' },
      { type: 'hashtag', hashtag: 'dogfriendlynyc', notes: 'Local NYC content' },
      { type: 'hashtag', hashtag: 'dogfriendlyla', notes: 'Local LA content' },
      { type: 'hashtag', hashtag: 'dogsofparis', notes: 'Paris dog community' },
      { type: 'hashtag', hashtag: 'dogsoftokyo', notes: 'Tokyo dog community' },
    ], { onConflict: 'id' });
    results.push({ step: 'Seed watchlist data', success: true });
  } catch (e) {
    results.push({ step: 'Seed watchlist data', success: false, error: String(e) });
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    message: `Migration complete: ${successCount} succeeded, ${failCount} failed`,
    results,
    timestamp: new Date().toISOString(),
  });
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin-only endpoint to run specific migrations
// Call POST /api/admin/migrate?migration=007_city_suggestions
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify the caller is an admin
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const migration = searchParams.get('migration');

  if (migration === '007_city_suggestions') {
    const statements = [
      `CREATE TABLE IF NOT EXISTS city_suggestions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        city_name TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT '',
        state_region TEXT DEFAULT '',
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        vote_count INT NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'launched', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS city_suggestion_votes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        suggestion_id UUID NOT NULL REFERENCES city_suggestions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(suggestion_id, user_id)
      )`,
    ];

    const results = [];
    for (const sql of statements) {
      const { error } = await supabase.rpc('exec_sql', { query: sql }).single();
      if (error) {
        // If rpc doesn't exist, try creating tables via REST insert test
        results.push({ sql: sql.substring(0, 60), error: error.message });
      } else {
        results.push({ sql: sql.substring(0, 60), status: 'ok' });
      }
    }

    return NextResponse.json({ migration, results });
  }

  return NextResponse.json({ error: 'Unknown migration' }, { status: 400 });
}

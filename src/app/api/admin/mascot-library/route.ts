export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAndUploadMascotImage } from '@/lib/dalle';
import { getLibraryTargets, listLibraryFiles } from '@/lib/mascot-library';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * GET /api/admin/mascot-library?secret=CRON_SECRET[&batch=8][&dryRun=true]
 *
 * One-time library builder (2026-08-29): generates the missing Marley & Buster
 * library images at medium quality into photos/mascot-library/. Idempotent —
 * existing files are never regenerated, so run repeatedly until remaining: 0.
 * Full library = 60 images ≈ $4 one-time, replacing $5-10 per approval batch.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'no supabase' }, { status: 500 });

  const batch = Math.min(Number(searchParams.get('batch')) || 8, 20);
  const dryRun = searchParams.get('dryRun') === 'true';

  const targets = getLibraryTargets();
  const existing = new Set(await listLibraryFiles(supabase));
  const missing = targets.filter(t => !existing.has(t.file));

  if (dryRun) {
    return NextResponse.json({
      total: targets.length,
      existing: existing.size,
      remaining: missing.length,
      next: missing.slice(0, batch).map(t => t.file),
    });
  }

  const generated: string[] = [];
  const failed: string[] = [];
  for (const t of missing.slice(0, batch)) {
    const result = await generateAndUploadMascotImage(t.prompt, `mascot-library/${t.file}`, { quality: 'medium' });
    if (result) generated.push(t.file);
    else failed.push(t.file);
  }

  return NextResponse.json({
    success: failed.length === 0,
    total: targets.length,
    existing: existing.size,
    generated,
    failed,
    remaining: missing.length - generated.length,
    hint: missing.length - generated.length > 0 ? 'run again to continue filling' : 'library complete',
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CONTENT_BANK, CITY_META } from '@/lib/social-content';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 300; // 5 minutes for batch generation

/**
 * Batch-generate all social creatives and store them in Supabase Storage.
 * Call once to pre-generate the entire content bank.
 * Skips any that already exist.
 *
 * GET /api/social/generate-all?secret=CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < CONTENT_BANK.length; i++) {
    const fact = CONTENT_BANK[i];
    const fileName = `social-creatives/${fact.city}-${i}.png`;

    // Check if already exists
    const { data: existing } = await supabase.storage
      .from('photos')
      .list('social-creatives', { search: `${fact.city}-${i}.png` });

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    try {
      // Call our own creative generator endpoint
      const response = await fetch(
        `${baseUrl}/api/social/generate-creative?secret=${secret}&index=${i}`,
        { method: 'GET' }
      );

      if (response.ok) {
        generated++;
        console.log(`Generated creative ${i + 1}/${CONTENT_BANK.length}: ${fact.city} - ${fact.headline}`);
      } else {
        failed++;
        console.error(`Failed creative ${i}: ${await response.text()}`);
      }

      // Rate limiting — 500ms between generations
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      failed++;
      console.error(`Error generating creative ${i}:`, e);
    }
  }

  return NextResponse.json({
    success: true,
    total: CONTENT_BANK.length,
    generated,
    skipped,
    failed,
    timestamp: new Date().toISOString(),
  });
}

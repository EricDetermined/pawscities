import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchPlace } from '@/lib/google-places';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 300; // Allow up to 5 minutes for this job

export async function GET(request: NextRequest) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch all establishments that have a google_place_id (these are Google-matched)
  const { data: establishments, error: fetchError } = await supabase
    .from('establishments')
    .select('id, name, address, google_place_id, photo_refs, city_id, dog_features')
    .not('google_place_id', 'is', null)
    .eq('status', 'ACTIVE')
    .order('updated_at', { ascending: true }) // Oldest-updated first
    .limit(50); // Process 50 at a time to stay within serverless timeout

  if (fetchError) {
    console.error('Failed to fetch establishments:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch establishments' }, { status: 500 });
  }

  if (!establishments || establishments.length === 0) {
    return NextResponse.json({ success: true, message: 'No establishments to refresh', updated: 0 });
  }

  // Look up city names for better search queries
  const cityIds = [...new Set(establishments.map(e => e.city_id).filter(Boolean))];
  const { data: cities } = await supabase
    .from('cities')
    .select('id, name')
    .in('id', cityIds);
  const cityMap: Record<string, string> = {};
  (cities || []).forEach((c: { id: string; name: string }) => { cityMap[c.id] = c.name; });

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const details: { name: string; status: string }[] = [];

  for (const est of establishments) {
    try {
      // Skip establishments with manually pinned photos
      const features = est.dog_features as Record<string, unknown> || {};
      if (features.photo_pinned) {
        skipped++;
        // Touch updated_at so it goes to the back of the queue
        await supabase
          .from('establishments')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', est.id);
        details.push({ name: est.name, status: 'pinned_skip' });
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      const cityName = cityMap[est.city_id] || '';
      const searchQuery = `${est.name} ${est.address || ''} ${cityName}`;
      const result = await searchPlace(searchQuery);

      if (result && result.photos && result.photos.length > 0) {
        const newPhotoRefs = result.photos.slice(0, 5).map((p: { name: string }) => p.name);
        const oldRefs = est.photo_refs || [];

        // Only update if photo refs actually changed
        if (JSON.stringify(newPhotoRefs) !== JSON.stringify(oldRefs)) {
          const primaryImage = `/api/places/photo?name=${encodeURIComponent(newPhotoRefs[0])}&maxWidth=800`;

          const { error: updateError } = await supabase
            .from('establishments')
            .update({
              photo_refs: newPhotoRefs,
              primary_image: primaryImage,
              google_place_id: result.id || est.google_place_id,
              google_maps_url: result.googleMapsUri || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', est.id);

          if (updateError) {
            console.error(`Failed to update ${est.name}:`, updateError.message);
            failed++;
            details.push({ name: est.name, status: 'update_failed' });
          } else {
            updated++;
            details.push({ name: est.name, status: 'updated' });
          }
        } else {
          skipped++;
          // Touch updated_at so it goes to the back of the queue
          await supabase
            .from('establishments')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', est.id);
          details.push({ name: est.name, status: 'unchanged' });
        }
      } else {
        failed++;
        details.push({ name: est.name, status: 'no_google_match' });
      }

      // Rate limiting: 150ms between requests to stay within Google API quotas
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (e) {
      console.error(`Error refreshing ${est.name}:`, e);
      failed++;
      details.push({ name: est.name, status: 'error' });
    }
  }

  const summary = `Photo refresh: ${updated} updated, ${skipped} unchanged, ${failed} failed out of ${establishments.length}`;
  console.log(summary);

  return NextResponse.json({
    success: true,
    message: summary,
    updated,
    skipped,
    failed,
    total: establishments.length,
    details,
    timestamp: new Date().toISOString(),
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchPlace, getPlaceById, nameMatchScore, isCrossScriptComparison, DEFAULT_MIN_NAME_SCORE } from '@/lib/google-places';
import { verifyCronAuth } from '@/lib/cron-auth';

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
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Cost optimization: reduced batch size (was 60) and added 30-day freshness gate
  // to minimize Google Places Text Search API calls
  //
  // EMERGENCY MODE (2026-08-23): ?force=true&batch=N ignores the freshness gate
  // and raises the batch cap. Added after Google invalidated ALL stored photo
  // resource names at once ("The photo resource in the request is invalid") —
  // photo names are NOT permanent and can expire in bulk, so a full re-fetch
  // must be possible on demand.
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  const BATCH_SIZE = Math.min(Number(searchParams.get('batch')) || 15, 60);
  const FRESHNESS_DAYS = 30;
  const freshnessDate = force
    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // future date = no gate
    : new Date(Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // PRIORITY 1: Establishments with no photos yet — these need initial enrichment
  const { data: needPhotos, error: needPhotosError } = await supabase
    .from('establishments')
    .select('id, name, address, google_place_id, photo_refs, city_id, dog_features, listing_type')
    .eq('status', 'ACTIVE')
    .is('photo_refs', null)
    .neq('listing_type', 'online')
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (needPhotosError) {
    console.error('Failed to fetch photo-less establishments:', needPhotosError);
    return NextResponse.json({ error: 'Failed to fetch establishments' }, { status: 500 });
  }

  // PRIORITY 2: Fill remaining slots with stale establishments that already have photos
  // Only refresh establishments not checked in the last FRESHNESS_DAYS days
  const remainingSlots = BATCH_SIZE - (needPhotos?.length || 0);
  let refreshEstablishments: typeof needPhotos = [];

  if (remainingSlots > 0) {
    const { data: refreshData, error: refreshError } = await supabase
      .from('establishments')
      .select('id, name, address, google_place_id, photo_refs, city_id, dog_features, listing_type')
      .eq('status', 'ACTIVE')
      .not('photo_refs', 'is', null)
      .not('google_place_id', 'is', null)
      .neq('listing_type', 'online')
      .lt('updated_at', freshnessDate)
      .order('updated_at', { ascending: true })
      .limit(remainingSlots);

    if (refreshError) {
      console.error('Failed to fetch refresh establishments:', refreshError);
    } else {
      refreshEstablishments = refreshData || [];
    }
  }

  const establishments = [...(needPhotos || []), ...refreshEstablishments];

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

      // Prefer a direct ID lookup when we already know the place — a fuzzy
      // re-search can drift onto a different venue and overwrite good photos.
      const result = est.google_place_id
        ? await getPlaceById(est.google_place_id as string)
        : await searchPlace(`${est.name} ${est.address || ''} ${cityName}`);

      // Guard the search path: only trust a hit whose name matches the venue.
      if (result && !est.google_place_id) {
        const score = nameMatchScore(est.name as string, result.displayName?.text || '');
        if (score < DEFAULT_MIN_NAME_SCORE && !isCrossScriptComparison(est.name as string, result.displayName?.text || '')) {
          skipped++;
          details.push({ name: est.name, status: 'name_mismatch_skip' });
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }
      }

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
        // No Google match found
        if (!est.google_place_id) {
          // First-time attempt — bump updated_at so we retry later (back of queue)
          skipped++;
          await supabase
            .from('establishments')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', est.id);
          details.push({ name: est.name, status: 'no_google_match_first_try' });
        } else {
          failed++;
          details.push({ name: est.name, status: 'no_google_match' });
        }
      }

      // Rate limiting: 150ms between requests to stay within Google API quotas
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (e) {
      console.error(`Error refreshing ${est.name}:`, e);
      failed++;
      details.push({ name: est.name, status: `error: ${String(e).slice(0, 160)}` });
    }
  }

  const needPhotosCount = needPhotos?.length || 0;
  const refreshCount = refreshEstablishments?.length || 0;
  const summary = `Photo refresh: ${updated} updated, ${skipped} unchanged, ${failed} failed out of ${establishments.length} (${needPhotosCount} needing photos, ${refreshCount} refresh)`;
  console.log(summary);

  return NextResponse.json({
    success: true,
    message: summary,
    updated,
    skipped,
    failed,
    total: establishments.length,
    needPhotosCount,
    refreshCount,
    details,
    timestamp: new Date().toISOString(),
  });
}

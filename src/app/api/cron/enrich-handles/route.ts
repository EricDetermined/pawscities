import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { enrichEventHandle, storeInCache } from '@/lib/handle-enrichment';
import { resolveEventBusinessHandles, mergeHandles } from '@/lib/business-handles';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/enrich-handles
 *
 * Enriches pending events with Instagram handles for their venues.
 * Runs daily after process-ingest. Processes up to 10 events per run.
 *
 * Waterfall: cache → DB match → Google Places → website scrape → web search
 */

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Non-useful source_handle values that should be enriched
const NEEDS_ENRICHMENT = new Set([
  null, '', 'unknown', '@unknown', 'google_events', 'curated_scrape', 'admin',
]);

function needsEnrichment(handle: string | null): boolean {
  if (!handle) return true;
  return NEEDS_ENRICHMENT.has(handle.toLowerCase().trim());
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const stats = { processed: 0, enriched: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Load city name mapping
    const { data: cities } = await supabase.from('cities').select('id, name');
    const cityNameMap: Record<string, string> = {};
    if (cities) {
      for (const c of cities) cityNameMap[c.id] = c.name;
    }

    // Fetch events needing enrichment
    // Priority: pending enrichment status + has a venue name + handle is missing/useless
    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('id, name, description, venue_name, venue_address, city_id, source_handle, mentioned_handles, status')
      .eq('enrichment_status', 'pending')
      .not('venue_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6); // lower per-run count: each event now resolves handles for all its businesses

    if (fetchError) {
      console.error('[ENRICH-HANDLES] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      console.log('[ENRICH-HANDLES] No events to enrich');
      return NextResponse.json({ message: 'No events to enrich', ...stats });
    }

    console.log(`[ENRICH-HANDLES] Processing ${events.length} events...`);

    for (const event of events) {
      stats.processed++;

      try {
        // Even when the source/venue handle is already good, still resolve and
        // tag every OTHER business named in the event (organizer, sponsors,
        // participating businesses) so no featured business goes untagged.
        if (!needsEnrichment(event.source_handle)) {
          const cityName = cityNameMap[event.city_id] || 'Unknown';
          let mentioned = [...(event.mentioned_handles || [])];
          if (event.source_handle) mentioned.push(event.source_handle);
          try {
            const resolvedBiz = await resolveEventBusinessHandles(
              { name: event.name, description: event.description, venue_name: event.venue_name },
              supabase, cityName,
            );
            mentioned = mergeHandles(mentioned, resolvedBiz, 8);
            if (resolvedBiz.length) console.log(`[ENRICH-HANDLES] "${event.venue_name}" (has source) → tagged ${resolvedBiz.length} businesses`);
          } catch (e) {
            console.error('[ENRICH-HANDLES] multi-business resolve failed:', (e as Error)?.message);
          }
          await supabase.from('events').update({
            enrichment_status: 'enriched',
            enrichment_attempted_at: new Date().toISOString(),
            mentioned_handles: mergeHandles(mentioned, [], 8),
          }).eq('id', event.id);
          stats.skipped++;
          console.log(`[ENRICH-HANDLES] Source handle kept for "${event.venue_name}" (@${event.source_handle})`);
          continue;
        }

        const cityName = cityNameMap[event.city_id] || 'Unknown';

        // Run the enrichment waterfall
        const result = await enrichEventHandle(event, supabase, cityName);

        // Update the event record
        const updateData: Record<string, unknown> = {
          enrichment_status: result.handle ? 'enriched' : 'failed',
          enrichment_attempted_at: new Date().toISOString(),
        };

        if (result.handle) {
          updateData.source_handle = result.handle;
        }

        // ── Tag EVERY business named in the event, not just the venue ────────
        // (2026-09-26, Eric) Our funnel is tagging dog-friendly businesses so
        // they discover us and claim a listing. Resolve handles for the
        // organizer, co-hosts, sponsors and participating businesses too, and
        // merge them all into mentioned_handles.
        let mentioned = [...(event.mentioned_handles || [])];
        if (result.handle) mentioned.push(result.handle);
        try {
          const resolvedBiz = await resolveEventBusinessHandles(
            { name: event.name, description: event.description, venue_name: event.venue_name },
            supabase, cityName,
          );
          mentioned = mergeHandles(mentioned, resolvedBiz, 8);
          if (resolvedBiz.length) {
            console.log(`[ENRICH-HANDLES] "${event.venue_name}" → tagged ${resolvedBiz.length} businesses: ${resolvedBiz.map(r => '@' + r.handle).join(' ')}`);
          }
        } catch (e) {
          console.error('[ENRICH-HANDLES] multi-business resolve failed:', (e as Error)?.message);
          mentioned = mergeHandles(mentioned, [], 8);
        }
        updateData.mentioned_handles = mentioned;

        if (result.establishmentId) {
          updateData.establishment_id = result.establishmentId;
        }

        await supabase.from('events').update(updateData).eq('id', event.id);

        // Store in cache for future lookups
        if (event.venue_name) {
          await storeInCache(event.venue_name, cityName, result, supabase);
        }

        // If we found a handle via scraping/search and matched an establishment,
        // save the handle to the establishment too
        if (result.handle && result.establishmentId && result.source !== 'db_match') {
          await supabase
            .from('establishments')
            .update({
              instagram_handle: result.handle,
              instagram_handle_source: result.source,
            })
            .eq('id', result.establishmentId);
          console.log(`[ENRICH-HANDLES] Updated establishment ${result.establishmentId} with @${result.handle}`);
        }

        if (result.handle) {
          stats.enriched++;
          console.log(`[ENRICH-HANDLES] ✓ "${event.venue_name}" → @${result.handle} (via ${result.source}, confidence: ${result.confidence})`);
        } else {
          stats.failed++;
          console.log(`[ENRICH-HANDLES] ✗ "${event.venue_name}" — no handle found`);
        }

        // Rate limit: small delay between events to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (eventError) {
        stats.failed++;
        const msg = `${event.id}: ${String(eventError)}`;
        stats.errors.push(msg);
        console.error(`[ENRICH-HANDLES] Error enriching "${event.venue_name}":`, eventError);

        // Mark as failed so we don't retry indefinitely
        await supabase
          .from('events')
          .update({
            enrichment_status: 'failed',
            enrichment_attempted_at: new Date().toISOString(),
          })
          .eq('id', event.id);
      }
    }

    console.log(`[ENRICH-HANDLES] Done: ${stats.enriched} enriched, ${stats.failed} failed, ${stats.skipped} skipped out of ${stats.processed}`);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[ENRICH-HANDLES] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

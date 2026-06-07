import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { CITY_META } from '@/lib/social-content';

export const maxDuration = 120;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/cron/weekly-roundup
//
// Generates weekly event roundup carousel creatives for each city.
// Runs every Sunday at 14:00 UTC.
//
// For each city with 3+ events in the coming week:
//   1. Generates a cover slide (branded "N Dog-Friendly Events This Week in City")
//   2. Generates individual event slides (with venue, date, sponsor handles)
//   3. Generates a CTA slide (link to pawcities.com/city/events)
//   4. Uploads all slides to Supabase Storage
//   5. Creates a creative_queue entry with format='carousel'
//
// Instagram limit: 10 slides per carousel (1 cover + 8 events + 1 CTA)
// ═══════════════════════════════════════════════════════════════════════════════

const MIN_EVENTS_FOR_ROUNDUP = 3;
const MAX_EVENT_SLIDES = 8; // Instagram carousel max is 10 total

interface EventForRoundup {
  id: string;
  name: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  is_free: boolean;
  source_handle: string | null;
  external_url: string | null;
  cities: { slug: string; name: string } | null;
}

export async function GET(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const forceCity = request.nextUrl.searchParams.get('city'); // override: generate for specific city only

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Calculate the coming week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() + daysUntilMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    console.log(`[WEEKLY-ROUNDUP] Generating roundups for week ${weekStartStr} to ${weekEndStr}`);

    // Format date range for display (e.g., "Jun 8–14" or "Jun 29 – Jul 5")
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const dateRange = startMonth === endMonth
      ? `${startMonth} ${weekStart.getUTCDate()}–${weekEnd.getUTCDate()}`
      : `${startMonth} ${weekStart.getUTCDate()} – ${endMonth} ${weekEnd.getUTCDate()}`;

    // Fetch all approved events for the coming week
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, name, start_date, start_time, end_time, venue_name, venue_address, is_free, source_handle, external_url, cities(slug, name)')
      .eq('status', 'APPROVED')
      .gte('start_date', weekStartStr)
      .lte('start_date', weekEndStr)
      .order('start_date', { ascending: true });

    if (eventsError) {
      console.error('[WEEKLY-ROUNDUP] Query error:', eventsError);
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      console.log('[WEEKLY-ROUNDUP] No approved events for the coming week');
      return NextResponse.json({ status: 'skipped', reason: 'No events for the coming week' });
    }

    // Group events by city
    // Supabase returns joined tables as arrays — normalize to single object
    const eventsByCity: Record<string, EventForRoundup[]> = {};
    for (const raw of events) {
      const citiesData = raw.cities;
      const city = Array.isArray(citiesData) ? citiesData[0] : citiesData;
      const event: EventForRoundup = { ...raw, cities: city || null };
      const citySlug = event.cities?.slug || 'unknown';
      if (!eventsByCity[citySlug]) eventsByCity[citySlug] = [];
      eventsByCity[citySlug].push(event);
    }

    const results: Array<{ city: string; eventCount: number; status: string; error?: string }> = [];
    const citiesToProcess = forceCity
      ? [forceCity]
      : Object.keys(eventsByCity);

    for (const citySlug of citiesToProcess) {
      const cityEvents = eventsByCity[citySlug];
      if (!cityEvents || cityEvents.length < MIN_EVENTS_FOR_ROUNDUP) {
        results.push({
          city: citySlug,
          eventCount: cityEvents?.length || 0,
          status: 'skipped',
          error: `Only ${cityEvents?.length || 0} events (need ${MIN_EVENTS_FOR_ROUNDUP}+)`,
        });
        continue;
      }

      // Check if we already generated a roundup for this city this week
      const { data: existing } = await supabase
        .from('creative_queue')
        .select('id')
        .eq('format', 'carousel')
        .eq('city', citySlug)
        .gte('created_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        results.push({ city: citySlug, eventCount: cityEvents.length, status: 'already_generated' });
        continue;
      }

      const eventsToShow = cityEvents.slice(0, MAX_EVENT_SLIDES);
      const cityName = cityEvents[0]?.cities?.name || CITY_META[citySlug]?.name || citySlug;
      const canonicalSlug = CITY_META[citySlug]?.slug || citySlug;

      if (dryRun) {
        results.push({ city: citySlug, eventCount: eventsToShow.length, status: 'dry_run' });
        continue;
      }

      try {
        // ── Generate slides ──────────────────────────────────────────────────
        const slideUrls: string[] = [];
        const baseUrl = getBaseUrl();

        // 1. Cover slide
        const coverParams = new URLSearchParams({
          slide: 'cover',
          citySlug: canonicalSlug,
          count: String(eventsToShow.length),
          dateRange,
        });
        const coverRes = await fetch(`${baseUrl}/api/social/roundup-slide?${coverParams}`);
        if (coverRes.ok) {
          const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
          const coverPath = `roundups/${canonicalSlug}-cover-${weekStartStr}.png`;
          const { error: uploadErr } = await supabase.storage
            .from('photos')
            .upload(coverPath, coverBuffer, { contentType: 'image/png', upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('photos').getPublicUrl(coverPath);
            if (urlData?.publicUrl) slideUrls.push(urlData.publicUrl);
          }
        }

        // 2. Event slides
        for (let i = 0; i < eventsToShow.length; i++) {
          const event = eventsToShow[i];
          const eventDate = new Date(event.start_date + 'T12:00:00Z');
          const dateDisplay = eventDate.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          });

          // Format time if available
          let timeDisplay = '';
          if (event.start_time) {
            const [h, m] = event.start_time.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
            timeDisplay = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
            if (event.end_time) {
              const [eh, em] = event.end_time.split(':').map(Number);
              const eampm = eh >= 12 ? 'PM' : 'AM';
              const ehour12 = eh > 12 ? eh - 12 : eh === 0 ? 12 : eh;
              timeDisplay += ` – ${ehour12}:${String(em).padStart(2, '0')} ${eampm}`;
            }
          }

          const eventParams = new URLSearchParams({
            slide: 'event',
            citySlug: canonicalSlug,
            name: event.name,
            date: dateDisplay,
            index: String(i + 1),
            total: String(eventsToShow.length),
          });
          if (event.venue_name) eventParams.set('venue', event.venue_name);
          if (timeDisplay) eventParams.set('time', timeDisplay);
          if (event.source_handle) eventParams.set('sponsor', event.source_handle);
          if (event.is_free) eventParams.set('free', 'true');

          const eventRes = await fetch(`${baseUrl}/api/social/roundup-slide?${eventParams}`);
          if (eventRes.ok) {
            const eventBuffer = Buffer.from(await eventRes.arrayBuffer());
            const eventPath = `roundups/${canonicalSlug}-event-${i + 1}-${weekStartStr}.png`;
            const { error: uploadErr } = await supabase.storage
              .from('photos')
              .upload(eventPath, eventBuffer, { contentType: 'image/png', upsert: true });
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('photos').getPublicUrl(eventPath);
              if (urlData?.publicUrl) slideUrls.push(urlData.publicUrl);
            }
          }

          // Brief delay to avoid overwhelming the image endpoint
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // 3. CTA slide
        const ctaParams = new URLSearchParams({
          slide: 'cta',
          citySlug: canonicalSlug,
        });
        const ctaRes = await fetch(`${baseUrl}/api/social/roundup-slide?${ctaParams}`);
        if (ctaRes.ok) {
          const ctaBuffer = Buffer.from(await ctaRes.arrayBuffer());
          const ctaPath = `roundups/${canonicalSlug}-cta-${weekStartStr}.png`;
          const { error: uploadErr } = await supabase.storage
            .from('photos')
            .upload(ctaPath, ctaBuffer, { contentType: 'image/png', upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('photos').getPublicUrl(ctaPath);
            if (urlData?.publicUrl) slideUrls.push(urlData.publicUrl);
          }
        }

        if (slideUrls.length < 3) {
          results.push({ city: citySlug, eventCount: eventsToShow.length, status: 'error', error: `Only generated ${slideUrls.length} slides` });
          continue;
        }

        // ── Generate caption ─────────────────────────────────────────────────
        // Collect all sponsor handles for the caption
        const sponsorHandles = eventsToShow
          .map(e => e.source_handle)
          .filter(Boolean)
          .map(h => `@${h!.replace(/^@/, '')}`)
          .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

        const eventListText = eventsToShow.map((e, i) => {
          const eventDate = new Date(e.start_date + 'T12:00:00Z');
          const day = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const venue = e.venue_name ? ` at ${e.venue_name}` : '';
          const free = e.is_free ? ' (FREE!)' : '';
          return `${i + 1}. ${e.name}${venue} — ${day}${free}`;
        }).join('\n');

        const caption = `🐾 ${eventsToShow.length} Dog-Friendly Events This Week in ${cityName} (${dateRange})

Swipe through for all the details! Here's what's happening:

${eventListText}

${sponsorHandles.length > 0 ? `📣 Shoutout to ${sponsorHandles.join(' ')} for making these happen!\n\n` : ''}🔗 Full details, venues & links → pawcities.com/${canonicalSlug}/events

Follow @thepawcities for dog-friendly events in 8 cities worldwide 🌎

#PawCities #DogsOfInstagram #DogFriendly #DogEvents #${cityName.replace(/\s/g, '')}Dogs #DogFriendly${cityName.replace(/\s/g, '')}`;

        // ── Create creative_queue entry ───────────────────────────────────────
        const scheduledFor = weekStart.toISOString().split('T')[0]; // Monday of the event week

        const { error: insertError } = await supabase
          .from('creative_queue')
          .insert({
            headline: `${eventsToShow.length} Dog-Friendly Events This Week in ${cityName}`,
            caption,
            narrator: 'both',
            city: citySlug,
            content_type: 'event',
            format: 'carousel',
            image_url: slideUrls[0], // Cover slide as preview
            carousel_urls: slideUrls, // All slide URLs for publishing
            status: 'pending_review',
            scheduled_for: scheduledFor,
          });

        if (insertError) {
          // carousel_urls column might not exist yet — try without it
          if (insertError.message?.includes('carousel_urls')) {
            const { error: retryError } = await supabase
              .from('creative_queue')
              .insert({
                headline: `${eventsToShow.length} Dog-Friendly Events This Week in ${cityName}`,
                caption,
                narrator: 'both',
                city: citySlug,
                content_type: 'event',
                format: 'carousel',
                image_url: slideUrls[0],
                // Store carousel URLs in image_prompt as JSON fallback
                image_prompt: JSON.stringify(slideUrls),
                status: 'pending_review',
                scheduled_for: scheduledFor,
              });

            if (retryError) {
              results.push({ city: citySlug, eventCount: eventsToShow.length, status: 'error', error: retryError.message });
              continue;
            }
          } else {
            results.push({ city: citySlug, eventCount: eventsToShow.length, status: 'error', error: insertError.message });
            continue;
          }
        }

        results.push({
          city: citySlug,
          eventCount: eventsToShow.length,
          status: 'generated',
        });

        console.log(`[WEEKLY-ROUNDUP] Generated ${slideUrls.length}-slide carousel for ${cityName} (${eventsToShow.length} events)`);

      } catch (err) {
        console.error(`[WEEKLY-ROUNDUP] Error generating ${citySlug} roundup:`, err);
        results.push({ city: citySlug, eventCount: cityEvents.length, status: 'error', error: String(err) });
      }
    }

    return NextResponse.json({
      status: 'completed',
      weekRange: `${weekStartStr} to ${weekEndStr}`,
      dateRange,
      results,
    });

  } catch (error) {
    console.error('[WEEKLY-ROUNDUP] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

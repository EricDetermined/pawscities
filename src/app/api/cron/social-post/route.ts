import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSiteBaseUrl } from '@/lib/base-url';
import { isBrowserIgSessionActive } from '@/lib/ig-lock';
import { publishImagePost, publishCarouselPost } from '@/lib/instagram';
import { generateAndUploadMascotImage } from '@/lib/dalle';

// ─── Config ────────────────────────────────────────────────────────────────────

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
  return getSiteBaseUrl();
}

// ─── Carousel Image Validation ────────────────────────────────────────────────
// Instagram's Content Publishing API only supports JPEG for carousel children.
// This pre-validates each URL and converts PNGs to JPEG via sharp + Supabase storage.

async function validateCarouselImages(urls: string[]): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const validatedUrls: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharpFn: any = null;
  try {
    // Dynamic require — sharp is optional, only needed for PNG→JPEG conversion
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sharpFn = require('sharp');
  } catch {
    console.warn('[SOCIAL-POST] sharp not available — skipping PNG conversion');
  }

  for (const url of urls) {
    try {
      // HEAD request to check content type
      const headRes = await fetch(url, { method: 'HEAD' });
      const contentType = headRes.headers.get('content-type') || '';

      if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
        validatedUrls.push(url);
      } else if (contentType.includes('image/png') || url.endsWith('.png')) {
        if (!sharpFn || !supabase) {
          console.warn(`[SOCIAL-POST] Cannot convert PNG — sharp or supabase missing, using original`);
          validatedUrls.push(url);
          continue;
        }
        console.log(`[SOCIAL-POST] Converting PNG carousel image to JPEG: ${url.slice(0, 80)}...`);
        const imgRes = await fetch(url);
        if (!imgRes.ok) {
          console.warn(`[SOCIAL-POST] Failed to fetch image: ${url}`);
          validatedUrls.push(url);
          continue;
        }
        const pngBuffer = Buffer.from(await imgRes.arrayBuffer());
        // Convert PNG to JPEG with white background (flatten alpha)
        const jpegBuffer = await sharpFn(pngBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: 92 })
          .toBuffer();

        const filename = `carousel-converted-${Date.now()}.jpg`;
        const storagePath = `launch-cards/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(storagePath, jpegBuffer, { contentType: 'image/jpeg', upsert: true });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(storagePath);
          console.log(`[SOCIAL-POST] Converted PNG→JPEG: ${publicUrl.publicUrl}`);
          validatedUrls.push(publicUrl.publicUrl);
        } else {
          console.warn(`[SOCIAL-POST] Upload failed: ${uploadError.message}, using original`);
          validatedUrls.push(url);
        }
      } else {
        console.warn(`[SOCIAL-POST] Unknown image format: ${contentType} — ${url.slice(0, 80)}`);
        validatedUrls.push(url);
      }
    } catch (err) {
      console.warn(`[SOCIAL-POST] Image validation error: ${err}`);
      validatedUrls.push(url);
    }
  }

  return validatedUrls;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/cron/social-post
//
// UNIFIED Instagram posting cron for @thepawcities.
// Runs up to 4× daily with slot preferences:
//   - 09:00 UTC  ?prefer=event&max=3      → morning event batch
//   - 13:00 UTC  ?prefer=content_bank     → midday content post
//   - 17:00 UTC  ?prefer=event&max=3      → afternoon event batch
//   - 21:00 UTC  ?prefer=content_bank     → evening content post
//
// Each run posts up to `max` items (default 1) from creative_queue.
// Event posts with approaching deadlines are always prioritized first.
// The `prefer` param controls which content_type to try first:
//   - If preferred type has approved creatives → pick that
//   - If not → fall back to any approved creative
//   - If nothing → skip (no post this slot)
//
// All content flows through creative_queue with admin review:
//   - Content bank fun facts → batch generated → reviewed → approved
//   - Events → discovered → approved → creative auto-generated → reviewed → approved
//   - Business spotlights → generated → reviewed → approved
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const prefer = request.nextUrl.searchParams.get('prefer'); // 'content_bank' | 'event' | null
  let maxPosts = Math.min(parseInt(request.nextUrl.searchParams.get('max') || '1', 10) || 1, 5);

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Defer if a browser engagement/discovery session is actively driving the IG
  // account — never automate the account from two surfaces at once (2026-08
  // suspension risk). Advisory lock with a staleness guard; a deferred post just
  // waits for its next slot (there are 4/day + a never-zero guarantee).
  if (await isBrowserIgSessionActive()) {
    console.log('[SOCIAL-POST] Deferred: a browser IG session is active (ig-lock held).');
    return NextResponse.json({ status: 'deferred', reason: 'browser_ig_session_active' });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const today = new Date().toISOString().split('T')[0];
    const addDaysStr = (n: number) => {
      const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    };
    const MIN_EVENT_LEAD_DAYS = 3; // every event must be promoted >= 3 days before it happens

    // ── Deadline-aware volume ─────────────────────────────────────────────────
    // If more event creatives hit their LAST promotable day (exactly the 3-day
    // floor) than the normal slot capacity, post more today (capped) so none
    // breaches the lead rule. A heavier day beats a stale or day-of post.
    try {
      const floorDate = addDaysStr(MIN_EVENT_LEAD_DAYS);
      const { data: dueRows } = await supabase
        .from('creative_queue').select('event_id')
        .eq('status', 'approved').eq('content_type', 'event').not('event_id', 'is', null)
        .lte('scheduled_for', today).limit(60);
      const ids = [...new Set((dueRows || []).map((c: { event_id: string }) => c.event_id))];
      if (ids.length) {
        const { data: evs } = await supabase.from('events').select('id, start_date').in('id', ids);
        const lastChance = (evs || []).filter((e: { start_date: string }) => (e.start_date || '').slice(0, 10) === floorDate).length;
        if (lastChance > maxPosts) {
          maxPosts = Math.min(8, lastChance);
          console.log(`[SOCIAL-POST] Deadline catch-up: ${lastChance} events at 3-day floor → maxPosts=${maxPosts}`);
        }
      }
    } catch (e) { console.log('[SOCIAL-POST] deadline catch-up skipped:', (e as Error)?.message); }

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const slot = prefer || 'any';
    const published: { headline: string; type: string; postId: string }[] = [];

    // ══════════════════════════════════════════════════════════════════════════
    // Multi-post loop: post up to `max` items per cron run.
    // Each iteration re-queries for fresh candidates (since the pool shrinks).
    // Event creatives with approaching deadlines are always sorted first.
    // ══════════════════════════════════════════════════════════════════════════

    for (let postNum = 0; postNum < maxPosts; postNum++) {

    let approvedCreatives: Record<string, unknown>[] | null = null;

    // ── Grid Diversity: Check recent post formats ─────────────────────────
    // Fetch the last 2 posted formats so we can avoid visual monotony
    let recentFormats: string[] = [];
    try {
      const { data: recentPosts } = await supabase
        .from('social_posts')
        .select('format')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(2);
      recentFormats = (recentPosts || []).map((p: { format: string }) => p.format).filter(Boolean);
    } catch {
      console.log('[SOCIAL-POST] Could not read recent formats from social_posts (column may not exist yet)');
    }

    // Step 1: Try preferred type
    if (prefer && ['content_bank', 'event'].includes(prefer)) {
      const { data } = await supabase
        .from('creative_queue')
        .select('*')
        .eq('status', 'approved')
        .eq('content_type', prefer)
        .lte('scheduled_for', today)
        .order('scheduled_for', { ascending: true })
        .limit(10);
      if (data && data.length > 0) {
        approvedCreatives = data;
        console.log(`[SOCIAL-POST] Slot=${slot} [${postNum + 1}/${maxPosts}]: Found ${data.length} preferred "${prefer}" creatives`);
      }
    }

    // Step 2: Fall back to any type
    if (!approvedCreatives || approvedCreatives.length === 0) {
      const { data } = await supabase
        .from('creative_queue')
        .select('*')
        .eq('status', 'approved')
        .lte('scheduled_for', today)
        .order('scheduled_for', { ascending: true })
        .limit(10);
      approvedCreatives = data;
      if (prefer && data && data.length > 0) {
        console.log(`[SOCIAL-POST] Slot=${slot} [${postNum + 1}/${maxPosts}]: No "${prefer}" creatives, falling back to ${data[0].content_type}`);
      }
    }

    // ── Step 3: NEVER-ZERO-POSTS fallback ─────────────────────────────────
    // If nothing is scheduled for today, PULL FORWARD the next future-scheduled
    // approved creative rather than going silent. A quiet feed loses followers;
    // posting a creative a few days early costs nothing.
    // (Only for the first post of a slot — later posts can end quietly.)
    if ((!approvedCreatives || approvedCreatives.length === 0) && postNum === 0) {
      const { data: futureCreatives } = await supabase
        .from('creative_queue')
        .select('*')
        .eq('status', 'approved')
        .gt('scheduled_for', today)
        .order('scheduled_for', { ascending: true })
        .limit(5);

      if (futureCreatives && futureCreatives.length > 0) {
        // For event creatives, only pull forward if the event is still ahead
        const usable = [];
        for (const c of futureCreatives) {
          if (c.content_type === 'event' && c.event_id) {
            const { data: ev } = await supabase
              .from('events').select('start_date').eq('id', c.event_id).single();
            // Only pull forward if the event still meets the 3-day lead floor.
            if (ev?.start_date && ev.start_date.slice(0, 10) < addDaysStr(MIN_EVENT_LEAD_DAYS)) continue;
          }
          // Never pull forward a stale weekly roundup either.
          if (c.format === 'carousel' && !c.event_id && (c.scheduled_for as string || '') < addDaysStr(-3)) continue;
          usable.push(c);
        }
        if (usable.length > 0) {
          console.log(`[SOCIAL-POST] ⚠️ EMPTY QUEUE FALLBACK: pulling forward "${usable[0].headline}" (was scheduled ${usable[0].scheduled_for})`);
          await supabase.from('creative_queue')
            .update({ scheduled_for: today })
            .eq('id', usable[0].id);
          usable[0].scheduled_for = today;
          approvedCreatives = usable;
        }
      }
    }

    if (!approvedCreatives || approvedCreatives.length === 0) {
      console.log(`[SOCIAL-POST] Slot=${slot} [${postNum + 1}/${maxPosts}]: No more approved creatives`);
      break; // No more candidates — exit loop
    }

    // ── TIMELINESS GATE (2026-09-26) ─────────────────────────────────────────
    // Every event must be promoted at least MIN_EVENT_LEAD_DAYS ahead of its
    // date. Anything past, same-day, or inside the lead window has missed its
    // window and must NOT post — that is what put a "this week (Sep 14-20)" post
    // out on Sep 26. Weekly "this week" roundups (carousel, no event_id) and any
    // creative that lingered well past its scheduled_for are dropped too.
    const minEventDate = addDaysStr(MIN_EVENT_LEAD_DAYS); // event start must be >= this
    const roundupStaleCutoff = addDaysStr(-3);            // a weekly roundup must post within 3 days of its week start
    const genericStaleCutoff = addDaysStr(-5);            // anything scheduled >5 days ago

    const eventCreatives = approvedCreatives.filter(c => c.content_type === 'event' && c.event_id);
    let eventDates = new Map<string, string>();
    if (eventCreatives.length > 0) {
      const eventIds = eventCreatives.map(c => c.event_id as string);
      const { data: events } = await supabase.from('events').select('id, start_date').in('id', eventIds);
      eventDates = new Map((events || []).map(e => [e.id, e.start_date]));
    }

    const dropIds = new Set<unknown>();
    for (const c of approvedCreatives) {
      const isEvent = c.content_type === 'event' && c.event_id;
      const isRoundup = c.format === 'carousel' && !c.event_id; // weekly "this week" roundup
      const sched = (c.scheduled_for as string) || '';
      let reason = '';
      if (isEvent) {
        const d = eventDates.get(c.event_id as string);
        const dd = d ? d.slice(0, 10) : '';
        if (!dd || dd < minEventDate) {
          reason = (dd && dd >= today)
            ? `Under ${MIN_EVENT_LEAD_DAYS}-day lead (event ${dd}) — auto-skipped ${today}`
            : `Event date ${dd || 'unknown'} passed/invalid — auto-expired ${today}`;
        }
      } else if (isRoundup && sched && sched < roundupStaleCutoff) {
        reason = `Stale weekly roundup (scheduled ${sched}) — auto-expired ${today}`;
      } else if (sched && sched < genericStaleCutoff) {
        reason = `Stale creative (scheduled ${sched}, >5 days late) — auto-expired ${today}`;
      }
      if (reason) {
        dropIds.add(c.id);
        console.log(`[SOCIAL-POST] Timeliness gate dropped "${c.headline}": ${reason}`);
        await supabase.from('creative_queue').update({ status: 'rejected', rejection_reason: reason }).eq('id', c.id);
      }
    }
    approvedCreatives = approvedCreatives.filter(c => !dropIds.has(c.id));

    if (approvedCreatives.length === 0) {
      console.log(`[SOCIAL-POST] Slot=${slot} [${postNum + 1}/${maxPosts}]: All candidates dropped by timeliness gate`);
      break;
    }

    // Post events closest to their (now >= 3-day) deadline first, so none slips
    // under the floor before it is promoted. Content sorts to the end.
    approvedCreatives.sort((a, b) => {
      const aDate = (a.content_type === 'event' && a.event_id) ? (eventDates.get(a.event_id as string) || '9999') : '9999';
      const bDate = (b.content_type === 'event' && b.event_id) ? (eventDates.get(b.event_id as string) || '9999') : '9999';
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
    });

    // ── Grid Diversity: Re-sort candidates to prefer different visual style ──
    // Apply diversity to ALL candidates including events. Only truly urgent
    // events (within 48 hours) override diversity preferences.
    const now = new Date();
    const urgentThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (recentFormats.length >= 2 && recentFormats[0] === recentFormats[1]) {
      const avoidFormat = recentFormats[0];
      approvedCreatives.sort((a, b) => {
        // Urgent events (within 48h) always come first regardless of format
        const aUrgent = a.content_type === 'event' && a.event_id && eventCreatives.length > 0;
        const bUrgent = b.content_type === 'event' && b.event_id && eventCreatives.length > 0;
        const aEventDate = aUrgent ? (eventDates?.get(a.event_id as string) || '9999') : '9999';
        const bEventDate = bUrgent ? (eventDates?.get(b.event_id as string) || '9999') : '9999';
        const aIsUrgent = aEventDate <= urgentThreshold;
        const bIsUrgent = bEventDate <= urgentThreshold;
        if (aIsUrgent && !bIsUrgent) return -1;
        if (!aIsUrgent && bIsUrgent) return 1;

        // Then prefer different format from recent posts
        const aMatch = (a.format === avoidFormat) ? 1 : 0;
        const bMatch = (b.format === avoidFormat) ? 1 : 0;
        return aMatch - bMatch;
      });
      console.log(`[SOCIAL-POST] Grid diversity: last 2 posts were "${avoidFormat}", preferring different visual style`);
    } else if (recentFormats.length >= 1) {
      const lastFormat = recentFormats[0];
      approvedCreatives.sort((a, b) => {
        const aMatch = (a.format === lastFormat) ? 1 : 0;
        const bMatch = (b.format === lastFormat) ? 1 : 0;
        return aMatch - bMatch;
      });
    }

    // Also fetch recently used photo IDs to avoid repeating the same dog photo
    let recentPhotoIds: string[] = [];
    try {
      const { data: recentPhotoPosts } = await supabase
        .from('social_posts')
        .select('photo_id')
        .eq('status', 'published')
        .not('photo_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
      recentPhotoIds = (recentPhotoPosts || []).map((p: { photo_id: string }) => p.photo_id).filter(Boolean);
    } catch {
      // photo_id column may not exist yet — that's fine
    }

    // Try each creative until one succeeds
    let postedThisIteration = false;
    for (const creative of approvedCreatives) {
      console.log(`[SOCIAL-POST] Attempting: "${creative.headline}" (${creative.content_type}, format: ${creative.format || 'legacy'})`);

      let imageUrl = creative.image_url as string | null;

      // ── Generate image if missing (visual-style-aware) ──────────────────
      if (!imageUrl) {
        const format = (creative.format as string) || 'mascot';

        if (format === 'mascot' && creative.image_prompt && hasOpenAI) {
          // MASCOT: DALL-E illustration of Buster/Marley
          const storagePath = `mascot-creatives/${creative.city}-${creative.content_type}-${creative.narrator}-${Date.now()}.png`;
          const dalleResult = await generateAndUploadMascotImage(creative.image_prompt as string, storagePath);
          if (dalleResult) {
            imageUrl = dalleResult.publicUrl;
          }
        } else if (format === 'text_card') {
          // TEXT CARD: Bold orange/white branded card via OG endpoint
          const cityMeta = creative.city ? (await import('@/lib/social-content')).CITY_META[creative.city as string] : null;
          const params = new URLSearchParams({
            headline: (creative.headline as string) || 'Dog-Friendly Tip',
            city: cityMeta?.name || (creative.city as string) || 'City',
            citySlug: cityMeta?.slug || (creative.city as string) || 'losangeles',
            type: (creative.content_type as string) === 'content_bank' ? 'tip' : (creative.content_type as string) || 'tip',
          });
          // Extract icon from caption if available
          const captionStr = creative.caption as string || '';
          const iconMatch = captionStr.match(/^(\p{Emoji_Presentation}|\p{Emoji}️)/u);
          if (iconMatch) params.set('icon', iconMatch[0]);
          try {
            const cardRes = await fetch(`${getBaseUrl()}/api/social/text-card-creative?${params}`);
            if (cardRes.ok) {
              const imgBuffer = Buffer.from(await cardRes.arrayBuffer());
              const storagePath = `text-cards/${creative.city}-${Date.now()}.png`;
              const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: true });
              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath);
                imageUrl = urlData?.publicUrl || null;
              }
            }
          } catch (err) {
            console.error(`[SOCIAL-POST] Text card generation failed:`, err);
          }
        } else if (format === 'photo' && creative.content_type === 'event' && creative.event_id) {
          // PHOTO: Event cityscape overlay via existing event-creative endpoint
          const { data: event } = await supabase
            .from('events')
            .select('*, cities(slug, name)')
            .eq('id', creative.event_id)
            .single();

          if (event) {
            const creativeParams = new URLSearchParams({
              name: event.name,
              city: event.cities?.name || 'City',
              citySlug: event.cities?.slug || 'losangeles',
              date: event.start_date,
            });
            if (event.venue_name) creativeParams.set('venue', event.venue_name);
            if (event.is_free) creativeParams.set('free', 'true');
            try {
              const creativeRes = await fetch(`${getBaseUrl()}/api/social/event-creative?${creativeParams}`);
              if (creativeRes.ok) {
                const imgBuffer = Buffer.from(await creativeRes.arrayBuffer());
                const storagePath = `event-photos/${creative.city}-event-${Date.now()}.png`;
                const { error: uploadError } = await supabase.storage
                  .from('photos')
                  .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: true });
                if (!uploadError) {
                  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath);
                  imageUrl = urlData?.publicUrl || null;
                }
              }
            } catch (err) {
              console.error(`[SOCIAL-POST] Event creative generation failed:`, err);
            }
          }
        } else if (creative.content_type === 'content_bank' && creative.content_index != null) {
          // LEGACY fallback: generate via generate-creative endpoint
          const creativeEndpoint = `${getBaseUrl()}/api/social/generate-creative?index=${creative.content_index}&preview=true&secret=${process.env.CRON_SECRET}`;
          try {
            const creativeRes = await fetch(creativeEndpoint);
            if (creativeRes.ok) {
              const imgBuffer = Buffer.from(await creativeRes.arrayBuffer());
              const storagePath = `instagram-posts/${creative.city}-content-${creative.content_index}-${Date.now()}.png`;
              const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: true });
              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath);
                imageUrl = urlData?.publicUrl || null;
              }
            }
          } catch (err) {
            console.error(`[SOCIAL-POST] Legacy creative generation failed:`, err);
          }
        }
      }

      // ── No image? Mark failed and try next ───────────────────────────────
      if (!imageUrl) {
        console.error(`[SOCIAL-POST] No image for "${creative.headline}", marking failed`);
        await supabase.from('creative_queue')
          .update({ status: 'failed', error_message: 'Could not generate image' })
          .eq('id', creative.id);
        continue;
      }

      // ── Verify image accessible ──────────────────────────────────────────
      try {
        const verifyRes = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
        if (!verifyRes.ok) {
          console.error(`[SOCIAL-POST] Image not accessible (HTTP ${verifyRes.status}) for "${creative.headline}"`);
          await supabase.from('creative_queue')
            .update({ status: 'failed', error_message: `Image not accessible: HTTP ${verifyRes.status}` })
            .eq('id', creative.id);
          continue;
        }
      } catch {
        await supabase.from('creative_queue')
          .update({ status: 'failed', error_message: 'Image verification timed out' })
          .eq('id', creative.id);
        continue;
      }

      // ── Dry run ──────────────────────────────────────────────────────────
      if (dryRun) {
        return NextResponse.json({
          status: 'dry_run',
          type: creative.content_type,
          headline: creative.headline,
          narrator: creative.narrator,
          city: creative.city,
          imageUrl,
          caption: creative.caption,
          scheduledFor: creative.scheduled_for,
        });
      }

      // ── Publish to Instagram ─────────────────────────────────────────────
      // Carousel posts use publishCarouselPost with multiple image URLs
      let result;
      if (creative.format === 'carousel') {
        // Get carousel URLs: try carousel_urls column, then image_prompt JSON fallback
        let carouselUrls: string[] = [];
        if (Array.isArray(creative.carousel_urls) && creative.carousel_urls.length > 0) {
          carouselUrls = creative.carousel_urls;
        } else if (creative.image_prompt) {
          try {
            const parsed = JSON.parse(creative.image_prompt as string);
            if (Array.isArray(parsed)) carouselUrls = parsed;
          } catch {
            // Not JSON — not a carousel URL list
          }
        }

        if (carouselUrls.length >= 2) {
          // Pre-validate carousel images: Instagram requires JPEG for carousel children
          // Convert any PNG/non-JPEG images to JPEG via our conversion endpoint
          const validatedUrls = await validateCarouselImages(carouselUrls);
          console.log(`[SOCIAL-POST] Publishing carousel with ${validatedUrls.length} slides for "${creative.headline}"`);
          result = await publishCarouselPost(validatedUrls, creative.caption as string);
        } else {
          // Fallback: publish as single image if we can't get carousel URLs
          console.log(`[SOCIAL-POST] Carousel only has ${carouselUrls.length} URLs, falling back to single image`);
          result = await publishImagePost(imageUrl as string, creative.caption as string);
        }
      } else {
        result = await publishImagePost(imageUrl as string, creative.caption as string);
      }

      // ── Log to social_posts ──────────────────────────────────────────────
      // Build social post record — include format and photo_id for grid diversity tracking
      // Extract photo_id from image_url if it's an Unsplash photo
      let photoId: string | null = null;
      if (imageUrl) {
        const unsplashMatch = (imageUrl as string).match(/images\.unsplash\.com\/(photo-[^?]+)/);
        if (unsplashMatch) photoId = unsplashMatch[1];
      }
      const postRecord: Record<string, unknown> = {
        platform: 'instagram',
        post_id: result.postId || null,
        container_id: result.containerId || null,
        headline: creative.headline,
        city: creative.city,
        caption: creative.caption,
        image_url: imageUrl,
        format: creative.format || 'mascot',  // Track visual style for grid diversity
        photo_id: photoId,                    // Track specific photo for dedup
        status: result.success ? 'published' : 'failed',
        error_message: result.error || null,
      };
      let postRow: { id: string } | null = null;
      const { data: insertedRow, error: postInsertErr } = await supabase.from('social_posts').insert(postRecord).select('id').single();
      if (postInsertErr) {
        // Column(s) may not exist yet — retry without optional columns
        delete postRecord.format;
        delete postRecord.photo_id;
        const { data: retryRow } = await supabase.from('social_posts').insert(postRecord).select('id').single();
        postRow = retryRow;
      } else {
        postRow = insertedRow;
      }

      // ── Update creative_queue ────────────────────────────────────────────
      await supabase.from('creative_queue')
        .update({
          status: result.success ? 'posted' : 'failed',
          posted_at: result.success ? new Date().toISOString() : null,
          social_post_id: postRow?.id || null,
          image_url: imageUrl,
          error_message: result.error || null,
        })
        .eq('id', creative.id);

      if (result.success) {
        console.log(`[SOCIAL-POST] Slot=${slot} [${postNum + 1}/${maxPosts}]: Published "${creative.headline}" (${creative.content_type}) via ${creative.narrator}`);
        published.push({
          headline: creative.headline as string,
          type: creative.content_type as string,
          postId: result.postId || '',
        });
        postedThisIteration = true;
        break; // Move to next iteration of the multi-post loop
      }

      // Failed to publish — try next creative in this iteration
      console.error(`[SOCIAL-POST] Instagram publish failed for "${creative.headline}": ${result.error}`);
    }

    if (!postedThisIteration && published.length === 0) {
      // First iteration failed entirely — report error
      return NextResponse.json({
        status: 'error',
        error: `All approved creatives failed to publish`,
      }, { status: 500 });
    }

    if (!postedThisIteration) {
      // Subsequent iteration couldn't find a working creative — stop
      console.log(`[SOCIAL-POST] Slot=${slot}: Stopping after ${published.length} posts (no more candidates succeeded)`);
      break;
    }

    } // end multi-post loop

    // ── Return summary ──────────────────────────────────────────────────────
    if (published.length === 0) {
      return NextResponse.json({
        status: 'skipped',
        slot,
        reason: 'No approved creatives ready to post.',
      });
    }

    return NextResponse.json({
      status: 'published',
      slot,
      count: published.length,
      maxPosts,
      posts: published,
    });

  } catch (error) {
    console.error('[SOCIAL-POST] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

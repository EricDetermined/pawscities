import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
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
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
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
  const maxPosts = Math.min(parseInt(request.nextUrl.searchParams.get('max') || '1', 10) || 1, 5);

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const today = new Date().toISOString().split('T')[0];
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

    if (!approvedCreatives || approvedCreatives.length === 0) {
      console.log(`[SOCIAL-POST] Slot=${slot} [${postNum + 1}/${maxPosts}]: No more approved creatives`);
      break; // No more candidates — exit loop
    }

    // ── Auto-expire event creatives whose event date has passed ──────────────
    const eventCreatives = approvedCreatives.filter(c => c.content_type === 'event' && c.event_id);
    if (eventCreatives.length > 0) {
      const eventIds = eventCreatives.map(c => c.event_id as string);
      const { data: events } = await supabase
        .from('events')
        .select('id, start_date')
        .in('id', eventIds);

      const eventDates = new Map((events || []).map(e => [e.id, e.start_date]));

      for (const creative of eventCreatives) {
        const eventDate = eventDates.get(creative.event_id as string);
        if (eventDate && eventDate < today) {
          console.log(`[SOCIAL-POST] Auto-expiring "${creative.headline}" — event date ${eventDate} has passed`);
          await supabase.from('creative_queue')
            .update({ status: 'rejected', rejection_reason: `Event date (${eventDate}) has passed — auto-expired` })
            .eq('id', creative.id);
        }
      }

      const expiredIds = new Set(
        eventCreatives
          .filter(c => {
            const d = eventDates.get(c.event_id as string);
            return d && d < today;
          })
          .map(c => c.id)
      );
      approvedCreatives = approvedCreatives.filter(c => !expiredIds.has(c.id));

      if (approvedCreatives.length === 0) {
        console.log(`[SOCIAL-POST] Slot=${slot} [${postNum + 1}/${maxPosts}]: All candidates expired (past events)`);
        break;
      }

      // ── Urgency sort: event creatives with soonest event date go first ──
      // This ensures we never miss posting an event because content was ahead in queue
      approvedCreatives.sort((a, b) => {
        const aIsEvent = a.content_type === 'event' && a.event_id;
        const bIsEvent = b.content_type === 'event' && b.event_id;
        const aDate = aIsEvent ? (eventDates.get(a.event_id as string) || '9999') : '9999';
        const bDate = bIsEvent ? (eventDates.get(b.event_id as string) || '9999') : '9999';
        // Events with closest deadlines come first; content sorts to the end
        return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
      });
    }

    // ── Grid Diversity: Re-sort candidates to prefer different visual style ──
    // Only apply grid diversity when there are NO event creatives in the pool.
    // When events are present, they've already been urgency-sorted by event date
    // above, and deadline priority overrides format diversity.
    const hasEventCreativesInPool = approvedCreatives.some(c => c.content_type === 'event' && c.event_id);

    if (!hasEventCreativesInPool) {
      if (recentFormats.length >= 2 && recentFormats[0] === recentFormats[1]) {
        const avoidFormat = recentFormats[0];
        approvedCreatives.sort((a, b) => {
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
          console.log(`[SOCIAL-POST] Publishing carousel with ${carouselUrls.length} slides for "${creative.headline}"`);
          result = await publishCarouselPost(carouselUrls, creative.caption as string);
        } else {
          // Fallback: publish as single image if we can't get carousel URLs
          console.log(`[SOCIAL-POST] Carousel only has ${carouselUrls.length} URLs, falling back to single image`);
          result = await publishImagePost(imageUrl as string, creative.caption as string);
        }
      } else {
        result = await publishImagePost(imageUrl as string, creative.caption as string);
      }

      // ── Log to social_posts ──────────────────────────────────────────────
      // Build social post record — include format if the column exists
      const postRecord: Record<string, unknown> = {
        platform: 'instagram',
        post_id: result.postId || null,
        container_id: result.containerId || null,
        headline: creative.headline,
        city: creative.city,
        caption: creative.caption,
        image_url: imageUrl,
        format: creative.format || 'mascot',  // Track visual style for grid diversity
        status: result.success ? 'published' : 'failed',
        error_message: result.error || null,
      };
      let postRow: { id: string } | null = null;
      const { data: insertedRow, error: postInsertErr } = await supabase.from('social_posts').insert(postRecord).select('id').single();
      if (postInsertErr && postInsertErr.message?.includes('format')) {
        // Column doesn't exist yet — retry without format field
        delete postRecord.format;
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

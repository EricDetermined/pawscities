import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishImagePost } from '@/lib/instagram';
import {
  CONTENT_BANK,
  CITY_META,
  generateCaption,
  generateEventCaption,
  pickNextContent,
} from '@/lib/social-content';

// ─── Config ────────────────────────────────────────────────────────────────────

// Read at request time, not build time
function getCronSecret() { return process.env.CRON_SECRET; }

/** How many days ahead to look for upcoming events */
const EVENT_LOOKAHEAD_DAYS = 14;

// ─── Supabase Admin ────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Get the deployment base URL for internal API calls */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/** Format an event date for display (e.g. "Sat, Jun 14") */
function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Format time for display (e.g. "2:00 PM") */
function formatEventTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Event row type from Supabase query ────────────────────────────────────────

interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  tags: string[] | null;
  source_handle: string | null;
  is_free: boolean;
  is_featured: boolean;
  status: string;
  cities: { slug: string; name: string } | null;
}

// ─── Main Route ────────────────────────────────────────────────────────────────

/**
 * GET /api/cron/social-post
 *
 * Events-first Instagram posting cron for @thepawcities.
 *
 * Priority 1: Post upcoming APPROVED events (next 14 days) that haven't
 *             been posted yet. Uses branded event creatives (city skyline +
 *             text overlay) which ALWAYS match the content.
 *
 * Priority 2: Fall back to content bank items ONLY if they have a
 *             pre-stored branded creative in Supabase Storage. Never uses
 *             Google Places photos — images must match post content.
 *
 * Max 1 post per invocation. Auth via CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronParam = request.nextUrl.searchParams.get('secret');
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

  const cronSecret = getCronSecret();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && cronParam !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // ── Load posting history ──────────────────────────────────────────────────
    const { data: publishedPosts } = await supabase
      .from('social_posts')
      .select('headline')
      .eq('status', 'published');

    const postedHeadlines = new Set(
      (publishedPosts || []).map((p: { headline: string }) => p.headline)
    );
    const totalPosted = postedHeadlines.size;

    // Also skip headlines that have failed 3+ times
    const { data: failedPosts } = await supabase
      .from('social_posts')
      .select('headline')
      .eq('status', 'failed');

    if (failedPosts) {
      const failCounts: Record<string, number> = {};
      for (const p of failedPosts) {
        failCounts[p.headline] = (failCounts[p.headline] || 0) + 1;
      }
      for (const [headline, count] of Object.entries(failCounts)) {
        if (count >= 3) {
          postedHeadlines.add(headline);
          console.log(`Skipping "${headline}" — failed ${count} times`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIORITY 1: Events
    // ══════════════════════════════════════════════════════════════════════════

    const today = new Date().toISOString().split('T')[0];
    const lookahead = new Date();
    lookahead.setDate(lookahead.getDate() + EVENT_LOOKAHEAD_DAYS);
    const lookaheadDate = lookahead.toISOString().split('T')[0];

    // Fetch approved events in the next 14 days, joined with city info
    const { data: upcomingEvents, error: eventsError } = await supabase
      .from('events')
      .select('id, slug, name, description, venue_name, venue_address, start_date, end_date, start_time, end_time, tags, source_handle, is_free, is_featured, status, cities(slug, name)')
      .eq('status', 'APPROVED')
      .gte('start_date', today)
      .lte('start_date', lookaheadDate)
      .order('start_date', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    }

    // Find the first event that hasn't been posted yet
    const unpostedEvent = (upcomingEvents as EventRow[] | null)?.find(
      (evt) => !postedHeadlines.has(evt.name)
    );

    if (unpostedEvent) {
      const city = unpostedEvent.cities;
      const citySlug = city?.slug || 'losangeles';
      const cityName = city?.name || 'City';

      // Map Supabase city slug to CITY_META key (e.g. "newyork" -> "nyc")
      const metaKey = Object.keys(CITY_META).find(
        k => CITY_META[k].slug === citySlug
      ) || citySlug;

      console.log(`[EVENT] Posting event: "${unpostedEvent.name}" in ${cityName}`);

      // ── Step 1: Generate branded creative via event-creative endpoint ──────
      const dateDisplay = formatEventDate(unpostedEvent.start_date);
      const timeDisplay = formatEventTime(unpostedEvent.start_time);
      const dateStr = timeDisplay ? `${dateDisplay} at ${timeDisplay}` : dateDisplay;

      const creativeParams = new URLSearchParams({
        name: unpostedEvent.name,
        city: cityName,
        citySlug,
        date: dateStr,
      });
      if (unpostedEvent.venue_name) creativeParams.set('venue', unpostedEvent.venue_name);
      if (unpostedEvent.tags?.length) creativeParams.set('tags', unpostedEvent.tags.join(','));
      if (unpostedEvent.is_free) creativeParams.set('free', 'true');

      const creativeUrl = `${getBaseUrl()}/api/social/event-creative?${creativeParams.toString()}`;
      console.log(`[EVENT] Fetching creative from: ${creativeUrl}`);

      const creativeRes = await fetch(creativeUrl);
      if (!creativeRes.ok) {
        const errText = await creativeRes.text();
        console.error(`[EVENT] Creative generation failed (${creativeRes.status}):`, errText);
        await supabase.from('social_posts').insert({
          platform: 'instagram',
          headline: unpostedEvent.name,
          city: metaKey,
          caption: '',
          status: 'failed',
          error_message: `Creative generation failed: HTTP ${creativeRes.status}`,
        });
        return NextResponse.json({
          status: 'error',
          error: `Failed to generate event creative: HTTP ${creativeRes.status}`,
        }, { status: 500 });
      }

      // ── Step 2: Upload creative to Supabase Storage ─────────────────────────
      const imgBuffer = Buffer.from(await creativeRes.arrayBuffer());
      const storagePath = `instagram-posts/${citySlug}-event-${unpostedEvent.slug}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(storagePath, imgBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error('[EVENT] Supabase upload error:', uploadError);
        await supabase.from('social_posts').insert({
          platform: 'instagram',
          headline: unpostedEvent.name,
          city: metaKey,
          caption: '',
          status: 'failed',
          error_message: `Storage upload failed: ${uploadError.message}`,
        });
        return NextResponse.json({
          status: 'error',
          error: `Failed to upload event creative: ${uploadError.message}`,
        }, { status: 500 });
      }

      // ── Step 3: Get public URL ──────────────────────────────────────────────
      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(storagePath);

      const imageUrl = publicUrlData?.publicUrl;
      if (!imageUrl) {
        return NextResponse.json({
          status: 'error',
          error: 'Failed to get public URL for uploaded creative',
        }, { status: 500 });
      }

      // Verify the image is accessible
      const verifyRes = await fetch(imageUrl, { method: 'HEAD' });
      if (!verifyRes.ok) {
        return NextResponse.json({
          status: 'error',
          error: `Uploaded creative not accessible: HTTP ${verifyRes.status}`,
        }, { status: 500 });
      }

      // ── Step 4: Generate caption ────────────────────────────────────────────
      const caption = generateEventCaption({
        name: unpostedEvent.name,
        cityName,
        citySlug: metaKey,
        venueName: unpostedEvent.venue_name,
        dateDisplay: dateStr,
        tags: unpostedEvent.tags || [],
        isFree: unpostedEvent.is_free,
        description: unpostedEvent.description,
      });

      // ── Dry run? ────────────────────────────────────────────────────────────
      if (dryRun) {
        return NextResponse.json({
          status: 'dry_run',
          type: 'event',
          event: {
            name: unpostedEvent.name,
            city: cityName,
            date: dateStr,
            venue: unpostedEvent.venue_name,
          },
          imageUrl,
          caption,
          totalPosted,
        });
      }

      // ── Step 5: Publish to Instagram ────────────────────────────────────────
      const result = await publishImagePost(imageUrl, caption);

      // ── Step 6: Log to social_posts ─────────────────────────────────────────
      await supabase.from('social_posts').insert({
        platform: 'instagram',
        post_id: result.postId || null,
        container_id: result.containerId || null,
        headline: unpostedEvent.name,
        city: metaKey,
        caption,
        image_url: imageUrl,
        status: result.success ? 'published' : 'failed',
        error_message: result.error || null,
      });

      if (!result.success) {
        return NextResponse.json({
          status: 'error',
          type: 'event',
          error: result.error,
          event: { name: unpostedEvent.name, city: cityName },
          imageUrl,
        }, { status: 500 });
      }

      return NextResponse.json({
        status: 'published',
        type: 'event',
        postId: result.postId,
        event: {
          name: unpostedEvent.name,
          city: cityName,
          date: dateStr,
          venue: unpostedEvent.venue_name,
        },
        totalPosted: totalPosted + 1,
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIORITY 2: Content bank with branded creatives ONLY
    // No events to post — fall back to content bank items that have a
    // pre-stored branded creative in Supabase Storage. If no creative
    // exists for an item, skip it entirely. NEVER use Google Places photos.
    // ══════════════════════════════════════════════════════════════════════════

    console.log('[CONTENT] No unposted events found, checking content bank with branded creatives...');

    const fact = pickNextContent(postedHeadlines);
    if (!fact) {
      return NextResponse.json({
        status: 'exhausted',
        message: 'All events posted and all content bank pieces used. Time to create new content!',
        totalPosted,
      });
    }

    // Check for a pre-generated branded creative in Supabase Storage
    const factIndex = CONTENT_BANK.indexOf(fact);
    let imageUrl = '';

    if (factIndex >= 0) {
      try {
        const prefix = `${fact.city}-${factIndex}-`;
        const { data: files } = await supabase.storage
          .from('photos')
          .list('social-creatives', {
            search: prefix,
            limit: 1,
          });

        if (files && files.length > 0) {
          const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(`social-creatives/${files[0].name}`);

          if (urlData?.publicUrl) {
            const testRes = await fetch(urlData.publicUrl, { method: 'HEAD' });
            if (testRes.ok) {
              imageUrl = urlData.publicUrl;
              console.log(`[CONTENT] Using stored branded creative "${files[0].name}" for "${fact.headline}"`);
            }
          }
        }
      } catch (err) {
        console.error('[CONTENT] Error checking for branded creative:', err);
      }
    }

    // If no branded creative exists, skip this item and try the next ones
    if (!imageUrl) {
      console.log(`[CONTENT] No branded creative for "${fact.headline}" — searching for another item with a creative...`);

      // Try remaining content bank items in order
      const tempPosted = new Set(postedHeadlines);
      tempPosted.add(fact.headline); // Skip the one we just tried

      let fallbackFact = pickNextContent(tempPosted);
      while (fallbackFact && !imageUrl) {
        const fbIndex = CONTENT_BANK.indexOf(fallbackFact);
        if (fbIndex >= 0) {
          try {
            const prefix = `${fallbackFact.city}-${fbIndex}-`;
            const { data: files } = await supabase.storage
              .from('photos')
              .list('social-creatives', {
                search: prefix,
                limit: 1,
              });

            if (files && files.length > 0) {
              const { data: urlData } = supabase.storage
                .from('photos')
                .getPublicUrl(`social-creatives/${files[0].name}`);

              if (urlData?.publicUrl) {
                const testRes = await fetch(urlData.publicUrl, { method: 'HEAD' });
                if (testRes.ok) {
                  imageUrl = urlData.publicUrl;
                  console.log(`[CONTENT] Found branded creative "${files[0].name}" for fallback "${fallbackFact.headline}"`);
                  // Use this fact instead
                  break;
                }
              }
            }
          } catch {
            // Continue searching
          }
        }

        tempPosted.add(fallbackFact.headline);
        fallbackFact = pickNextContent(tempPosted);
      }

      // If we found a fallback with a creative, use it
      if (imageUrl && fallbackFact) {
        // Reassign to the fallback fact that has a creative
        return await publishContentPost(supabase, fallbackFact, imageUrl, postedHeadlines, totalPosted, dryRun);
      }

      // No content bank items have branded creatives — nothing to post
      return NextResponse.json({
        status: 'no_creative',
        message: 'No events to post and no content bank items have branded creatives. Generate creatives via the admin dashboard.',
        totalPosted,
      });
    }

    // We have a branded creative for the primary fact — publish it
    return await publishContentPost(supabase, fact, imageUrl, postedHeadlines, totalPosted, dryRun);

  } catch (error) {
    console.error('Social post cron error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ─── Helper: publish a content bank post ───────────────────────────────────────

async function publishContentPost(
  supabase: ReturnType<typeof createClient>,
  fact: (typeof CONTENT_BANK)[number],
  imageUrl: string,
  postedHeadlines: Set<string>,
  totalPosted: number,
  dryRun: boolean,
): Promise<NextResponse> {
  const cityMeta = CITY_META[fact.city];
  const caption = generateCaption(fact);

  if (dryRun) {
    return NextResponse.json({
      status: 'dry_run',
      type: 'content_bank',
      fact: {
        city: fact.city,
        cityName: cityMeta?.name,
        headline: fact.headline,
        body: fact.body,
      },
      imageUrl,
      caption,
      totalPosted,
      remainingContent: CONTENT_BANK.length - postedHeadlines.size,
    });
  }

  // Publish to Instagram
  const result = await publishImagePost(imageUrl, caption);

  // Log to Supabase
  await supabase.from('social_posts').insert({
    platform: 'instagram',
    post_id: result.postId || null,
    container_id: result.containerId || null,
    headline: fact.headline,
    city: fact.city,
    caption,
    image_url: imageUrl,
    status: result.success ? 'published' : 'failed',
    error_message: result.error || null,
  });

  if (!result.success) {
    return NextResponse.json({
      status: 'error',
      type: 'content_bank',
      error: result.error,
      fact: { city: fact.city, headline: fact.headline },
      imageUrl,
    }, { status: 500 });
  }

  return NextResponse.json({
    status: 'published',
    type: 'content_bank',
    postId: result.postId,
    fact: {
      city: fact.city,
      cityName: cityMeta?.name,
      headline: fact.headline,
    },
    totalPosted: totalPosted + 1,
    remainingContent: CONTENT_BANK.length - postedHeadlines.size - 1,
  });
}

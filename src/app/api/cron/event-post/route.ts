import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { publishImagePost } from '@/lib/instagram';
import { CITY_META } from '@/lib/social-content';
import { generateAndUploadMascotImage, generateCharacterCaption } from '@/lib/dalle';

// ─── Config ────────────────────────────────────────────────────────────────────

/** How many days ahead to look for upcoming events */
const EVENT_LOOKAHEAD_DAYS = 14;

export const maxDuration = 120;

// ─── Supabase Admin ────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── City landmarks for mascot images ──────────────────────────────────────────

const CITY_LANDMARKS: Record<string, { landmark: string; activity_buster: string; setting_marley: string }> = {
  paris: { landmark: 'the Eiffel Tower peeking above Parisian rooftops', activity_buster: 'sitting at a sidewalk café', setting_marley: 'a cozy Parisian café window seat' },
  geneva: { landmark: 'the Jet d\'Eau fountain on Lake Geneva', activity_buster: 'trotting along the lakeside promenade', setting_marley: 'a Swiss train window seat overlooking Lake Geneva' },
  london: { landmark: 'Tower Bridge', activity_buster: 'walking happily along the Thames', setting_marley: 'a warm pub corner with a fireplace' },
  barcelona: { landmark: 'the Sagrada Familia basilica', activity_buster: 'playing in a sunny park', setting_marley: 'a sunny terrace overlooking the Gothic Quarter' },
  losangeles: { landmark: 'the Hollywood sign in the distance', activity_buster: 'hiking on a trail in the California sunshine', setting_marley: 'a breezy beachside patio' },
  nyc: { landmark: 'the Central Park skyline', activity_buster: 'running through an open meadow', setting_marley: 'a cozy Brooklyn brownstone window' },
  sydney: { landmark: 'the Sydney Opera House', activity_buster: 'sitting on the harbour steps', setting_marley: 'a waterfront café with harbour views' },
  tokyo: { landmark: 'the Shibuya Crossing', activity_buster: 'sitting near the Hachiko statue', setting_marley: 'a traditional Japanese tea house' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Map Supabase city slug (e.g. "newyork") to CITY_META key (e.g. "nyc") */
function getCityMetaKey(slug: string): string {
  return Object.keys(CITY_META).find(k => CITY_META[k].slug === slug) || slug;
}

// ─── Mascot image prompt for events ────────────────────────────────────────────

function buildEventImagePrompt(
  eventName: string,
  cityName: string,
  metaKey: string,
  narrator: 'buster' | 'marley',
  venueName?: string | null,
): string {
  const landmarks = CITY_LANDMARKS[metaKey] || CITY_LANDMARKS.paris;
  const venueContext = venueName ? ` near ${venueName}` : '';

  if (narrator === 'buster') {
    return `Pixar/Disney-style cartoon illustration: Buster, a compact golden-tan smooth-coated mixed breed dog with folded ears, big expressive brown eyes, wide happy grin with tongue out, wearing an olive-green collar with a small orange paw-print tag, standing excitedly${venueContext} in ${cityName} with ${landmarks.landmark} in the background. Bright cheerful atmosphere suggesting a fun dog-friendly event. Several happy dogs of different breeds nearby. Warm lighting, cinematic. 1080x1080, no text overlay, no humans.`;
  }

  return `Pixar/Disney-style cartoon illustration: Marley, a fluffy golden-apricot goldendoodle with curly teddy bear coat, soulful intelligent brown eyes, calm gentle smile, wearing a navy blue bandana with a small orange paw-print tag, sitting calmly${venueContext} in ${cityName} with ${landmarks.landmark} in the background. Warm cozy atmosphere, several friendly dogs nearby. Soft lighting, inviting scene. 1080x1080, no text overlay, no humans.`;
}

// ─── Mascot event caption ──────────────────────────────────────────────────────

function buildEventCaption(
  narrator: 'buster' | 'marley',
  eventName: string,
  cityName: string,
  citySlug: string,
  dateDisplay: string,
  venueName?: string | null,
  description?: string | null,
  isFree?: boolean,
  tags?: string[] | null,
  sourceHandle?: string | null,
): string {
  const venueStr = venueName ? `\n📍 ${venueName}` : '';
  const freeStr = isFree ? '\n🆓 Free event!' : '';
  const handleStr = sourceHandle ? `\n\nShoutout to @${sourceHandle.replace('@', '')} for putting this together!` : '';

  const tagSet = new Set(['PawCities', 'DogFriendlyEvents', 'DogsOfInstagram', 'DogLife']);
  tagSet.add(cityName.replace(/\s/g, '') + 'Dogs');
  tagSet.add('DogFriendly' + cityName.replace(/\s/g, ''));
  if (tags) {
    for (const t of tags.slice(0, 3)) {
      tagSet.add(t.replace(/[^a-zA-Z0-9]/g, ''));
    }
  }
  const hashtagStr = Array.from(tagSet).map(t => '#' + t).join(' ');

  if (narrator === 'buster') {
    const intros = [
      `Hey pack! 🐾 Check out this awesome event coming up in ${cityName}!`,
      `Who else is excited?! 🎉 Look what's happening in ${cityName}!`,
      `Tail wags for this one! 🐕 ${cityName} has something special coming up!`,
      `Let's GO! 🐾 Found another amazing dog-friendly event in ${cityName}!`,
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];
    return `${intro}\n\n📅 ${eventName}\n🗓 ${dateDisplay}${venueStr}${freeStr}\n\n${description || 'This is gonna be pawsome!'}\n${handleStr}\n\nWho's coming? Tag your dog park crew! 🐕‍🦺\n\nDiscover more events at pawcities.com/${citySlug}/events\nFollow @thepawcities for daily dog-friendly adventures! 🌍\n\n${hashtagStr}`;
  }

  // Marley voice — calm, informative
  const intros = [
    `${cityName} event alert. 🐾 Here's one worth marking on the calendar...`,
    `Something good is coming to ${cityName}...`,
    `For those of us who plan ahead. 🐾 ${cityName} has a treat in store...`,
    `Worth noting, ${cityName} friends...`,
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];
  return `${intro}\n\n📅 ${eventName}\n🗓 ${dateDisplay}${venueStr}${freeStr}\n\n${description || 'A wonderful opportunity for the community.'}\n${handleStr}\n\nMore events at pawcities.com/${citySlug}/events\nFollow @thepawcities for daily dog-friendly tips! 🌍\n\n${hashtagStr}`;
}

// ─── Event row type ────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  tags: string[] | null;
  source_handle: string | null;
  is_free: boolean;
  is_featured: boolean;
  mentioned_handles: string[] | null;
  cities: { slug: string; name: string } | null;
}

// ─── Establishment type for business spotlights ────────────────────────────────

interface EstablishmentRow {
  id: string;
  name: string;
  city_id: string;
  address: string | null;
  description: string | null;
  photo_url: string | null;
  rating: number | null;
  google_place_id: string | null;
  slug: string;
  cities: { slug: string; name: string } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/cron/event-post
//
// Second daily post — runs at 18:00 UTC (4 hours after the mascot fun-facts
// post at 14:00 UTC).
//
// Priority:
//   1. Upcoming APPROVED events (next 14 days) not yet posted as event posts
//   2. Business spotlights — feature an active establishment with Buster/Marley
//   3. City dog-scene facts (fallback)
//
// Each post features Buster or Marley (alternating) to keep the mascot brand
// consistent and drive business/sponsor awareness.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

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

    // Load already-posted event headlines (to avoid duplicates)
    const { data: postedRows } = await supabase
      .from('social_posts')
      .select('headline')
      .eq('status', 'published');
    const postedHeadlines = new Set(
      (postedRows || []).map((p: { headline: string }) => p.headline)
    );

    // Determine narrator (alternate based on last event post)
    const { data: lastEventPost } = await supabase
      .from('social_posts')
      .select('caption')
      .eq('status', 'published')
      .like('caption', '%#DogFriendlyEvents%')
      .order('created_at', { ascending: false })
      .limit(1);

    // Simple alternation: if last event post contained "Buster" vibes, use Marley next
    const lastCaption = lastEventPost?.[0]?.caption || '';
    const narrator: 'buster' | 'marley' = lastCaption.includes('Let\'s GO') || lastCaption.includes('Who else is excited') || lastCaption.includes('Tag your dog park')
      ? 'marley'
      : 'buster';

    // ══════════════════════════════════════════════════════════════════════════
    // PRIORITY 1: Upcoming events
    // ══════════════════════════════════════════════════════════════════════════

    const lookahead = new Date();
    lookahead.setDate(lookahead.getDate() + EVENT_LOOKAHEAD_DAYS);
    const lookaheadDate = lookahead.toISOString().split('T')[0];

    const { data: upcomingEvents } = await supabase
      .from('events')
      .select('id, slug, name, description, venue_name, start_date, end_date, start_time, end_time, tags, source_handle, is_free, is_featured, mentioned_handles, cities(slug, name)')
      .eq('status', 'APPROVED')
      .gte('start_date', today)
      .lte('start_date', lookaheadDate)
      .order('start_date', { ascending: true });

    const unpostedEvent = (upcomingEvents as unknown as EventRow[] | null)?.find(
      (evt) => !postedHeadlines.has(evt.name)
    );

    if (unpostedEvent) {
      const city = unpostedEvent.cities;
      const citySlug = city?.slug || 'losangeles';
      const cityName = city?.name || 'City';
      const metaKey = getCityMetaKey(citySlug);

      const dateDisplay = formatEventDate(unpostedEvent.start_date);
      const timeDisplay = formatEventTime(unpostedEvent.start_time);
      const dateStr = timeDisplay ? `${dateDisplay} at ${timeDisplay}` : dateDisplay;

      console.log(`[EVENT-POST] Posting event: "${unpostedEvent.name}" in ${cityName} (${narrator})`);

      // Generate mascot image via DALL-E
      let imageUrl: string | null = null;
      if (hasOpenAI) {
        const imagePrompt = buildEventImagePrompt(unpostedEvent.name, cityName, metaKey, narrator, unpostedEvent.venue_name);
        const storagePath = `mascot-creatives/${metaKey}-event-${narrator}-${Date.now()}.png`;
        const dalleResult = await generateAndUploadMascotImage(imagePrompt, storagePath);
        if (dalleResult) {
          imageUrl = dalleResult.publicUrl;
        }
      }

      if (!imageUrl) {
        // Fallback: use event-creative endpoint (non-mascot branded image)
        const creativeParams = new URLSearchParams({
          name: unpostedEvent.name,
          city: cityName,
          citySlug,
          date: dateStr,
        });
        if (unpostedEvent.venue_name) creativeParams.set('venue', unpostedEvent.venue_name);

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const creativeRes = await fetch(`${baseUrl}/api/social/event-creative?${creativeParams}`);
        if (creativeRes.ok) {
          const imgBuffer = Buffer.from(await creativeRes.arrayBuffer());
          const storagePath = `instagram-posts/${citySlug}-event-mascot-${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath);
            imageUrl = urlData?.publicUrl || null;
          }
        }
      }

      if (!imageUrl) {
        console.error('[EVENT-POST] Could not generate image for event');
        await supabase.from('social_posts').insert({
          platform: 'instagram',
          headline: unpostedEvent.name,
          city: metaKey,
          caption: '',
          status: 'failed',
          error_message: 'Could not generate event mascot image',
        });
        return NextResponse.json({ status: 'error', error: 'Image generation failed' }, { status: 500 });
      }

      // Generate caption (try AI, fall back to template)
      let caption: string;
      if (hasOpenAI) {
        const aiCaption = await generateCharacterCaption(
          narrator,
          unpostedEvent.name,
          unpostedEvent.description || 'An exciting dog-friendly event!',
          cityName,
          citySlug,
          'event',
        );
        caption = aiCaption || buildEventCaption(narrator, unpostedEvent.name, cityName, citySlug, dateStr, unpostedEvent.venue_name, unpostedEvent.description, unpostedEvent.is_free, unpostedEvent.tags, unpostedEvent.source_handle);
      } else {
        caption = buildEventCaption(narrator, unpostedEvent.name, cityName, citySlug, dateStr, unpostedEvent.venue_name, unpostedEvent.description, unpostedEvent.is_free, unpostedEvent.tags, unpostedEvent.source_handle);
      }

      if (dryRun) {
        return NextResponse.json({
          status: 'dry_run',
          type: 'event',
          narrator,
          event: { name: unpostedEvent.name, city: cityName, date: dateStr, venue: unpostedEvent.venue_name },
          imageUrl,
          caption,
        });
      }

      // Publish to Instagram
      const result = await publishImagePost(imageUrl, caption);

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

      if (result.success) {
        return NextResponse.json({
          status: 'published',
          type: 'event',
          narrator,
          postId: result.postId,
          event: { name: unpostedEvent.name, city: cityName, date: dateStr },
        });
      }

      return NextResponse.json({ status: 'error', type: 'event', error: result.error }, { status: 500 });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIORITY 2: Business spotlight (no events available)
    // Feature a random active establishment with Buster or Marley
    // ══════════════════════════════════════════════════════════════════════════

    console.log('[EVENT-POST] No unposted events found, trying business spotlight...');

    // Get a random active establishment with a photo
    const { data: establishments } = await supabase
      .from('establishments')
      .select('id, name, city_id, address, description, photo_url, rating, google_place_id, slug, cities(slug, name)')
      .eq('status', 'ACTIVE')
      .not('photo_url', 'is', null)
      .limit(50);

    if (establishments && establishments.length > 0) {
      // Filter out already-spotlighted ones
      const spotlightPrefix = '📍 Spotlight:';
      const availableEstablishments = (establishments as EstablishmentRow[]).filter(
        e => !postedHeadlines.has(spotlightPrefix + ' ' + e.name)
      );

      if (availableEstablishments.length > 0) {
        // Pick a random one
        const est = availableEstablishments[Math.floor(Math.random() * availableEstablishments.length)];
        const cityName = est.cities?.name || 'City';
        const citySlug = est.cities?.slug || 'losangeles';
        const metaKey = getCityMetaKey(citySlug);
        const headline = spotlightPrefix + ' ' + est.name;

        console.log(`[EVENT-POST] Business spotlight: "${est.name}" in ${cityName} (${narrator})`);

        // Generate mascot image
        let imageUrl: string | null = null;
        if (hasOpenAI) {
          const landmarks = CITY_LANDMARKS[metaKey] || CITY_LANDMARKS.paris;
          const spotlightPrompt = narrator === 'buster'
            ? `Pixar/Disney-style cartoon illustration: Buster, a compact golden-tan smooth-coated mixed breed dog with folded ears, big expressive brown eyes, wide happy grin, olive-green collar with orange paw tag, standing proudly outside a charming dog-friendly establishment in ${cityName}, ${landmarks.landmark} visible in background. Warm golden lighting, welcoming storefront, outdoor seating area. 1080x1080, no text, no humans.`
            : `Pixar/Disney-style cartoon illustration: Marley, a fluffy golden-apricot goldendoodle with curly coat, calm smile, navy blue bandana with orange paw tag, relaxing at a cozy dog-friendly spot in ${cityName}, ${landmarks.landmark} visible through the window. Warm ambient lighting, inviting atmosphere. 1080x1080, no text, no humans.`;

          const storagePath = `mascot-creatives/${metaKey}-spotlight-${narrator}-${Date.now()}.png`;
          const dalleResult = await generateAndUploadMascotImage(spotlightPrompt, storagePath);
          if (dalleResult) {
            imageUrl = dalleResult.publicUrl;
          }
        }

        // Fallback to establishment photo
        if (!imageUrl) {
          imageUrl = est.photo_url;
        }

        if (!imageUrl) {
          return NextResponse.json({ status: 'skipped', reason: 'No image available for spotlight' });
        }

        // Build spotlight caption
        const ratingStr = est.rating ? `\n⭐ ${est.rating}/5` : '';
        const addressStr = est.address ? `\n📍 ${est.address}` : '';

        const caption = narrator === 'buster'
          ? `Hey friends! 🐾 Found another amazing dog-friendly spot in ${cityName}!\n\n🏪 ${est.name}${addressStr}${ratingStr}\n\n${est.description || 'This place is super dog-friendly — definitely worth checking out!'}\n\nHave you been here? Drop a 🐾 if you have!\n\nDiscover more dog-friendly spots at pawcities.com/${citySlug}\nFollow @thepawcities for daily dog-friendly discoveries! 🌍\n\n#PawCities #DogFriendly${cityName.replace(/\s/g, '')} #${cityName.replace(/\s/g, '')}Dogs #DogsOfInstagram #DogFriendlyPlaces #DogLife`
          : `${cityName} gem. 🐾 Here's a dog-friendly spot worth knowing about...\n\n🏪 ${est.name}${addressStr}${ratingStr}\n\n${est.description || 'A wonderful dog-friendly establishment to add to your list.'}\n\nMore dog-friendly spots at pawcities.com/${citySlug}\nFollow @thepawcities for daily dog-friendly tips! 🌍\n\n#PawCities #DogFriendly${cityName.replace(/\s/g, '')} #${cityName.replace(/\s/g, '')}Dogs #DogsOfInstagram #DogFriendlyPlaces #DogLife`;

        if (dryRun) {
          return NextResponse.json({
            status: 'dry_run',
            type: 'business_spotlight',
            narrator,
            establishment: { name: est.name, city: cityName, address: est.address },
            imageUrl,
            caption,
          });
        }

        const result = await publishImagePost(imageUrl, caption);

        await supabase.from('social_posts').insert({
          platform: 'instagram',
          post_id: result.postId || null,
          container_id: result.containerId || null,
          headline,
          city: metaKey,
          caption,
          image_url: imageUrl,
          status: result.success ? 'published' : 'failed',
          error_message: result.error || null,
        });

        if (result.success) {
          return NextResponse.json({
            status: 'published',
            type: 'business_spotlight',
            narrator,
            postId: result.postId,
            establishment: { name: est.name, city: cityName },
          });
        }

        return NextResponse.json({ status: 'error', type: 'business_spotlight', error: result.error }, { status: 500 });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIORITY 3: Nothing to post today
    // ══════════════════════════════════════════════════════════════════════════

    console.log('[EVENT-POST] No events or spotlights available — skipping today');
    return NextResponse.json({
      status: 'skipped',
      reason: 'No unposted events or spotlight candidates available',
    });

  } catch (error) {
    console.error('[EVENT-POST] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CONTENT_BANK,
  CITY_META,
  generateCaption,
  pickNextContent,
} from '@/lib/social-content';
import { generateAndUploadMascotImage, generateCharacterCaption } from '@/lib/dalle';
import { getVisualStyle, shouldUseMascot, shouldUseTextCard, getCaptionStyle, type VisualStyle } from '@/lib/visual-strategy';

// ─── Supabase Admin ────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Mascot assignment logic ──────────────────────────────────────────────────

// Track narrator alternation within a batch generation run
let batchNarratorIndex = 0;

function assignNarrator(type: string): 'buster' | 'marley' | 'both' {
  // "both" only for the very first intro post — all others alternate
  // Force alternation: odd positions get buster, even get marley (or vice versa)
  // This overrides the type-based logic to ensure visual variety in the feed
  const narrator: 'buster' | 'marley' = batchNarratorIndex % 2 === 0 ? 'buster' : 'marley';
  batchNarratorIndex++;
  return narrator;
}

// ─── Character voice captions ─────────────────────────────────────────────────

function rewriteCaption(fact: typeof CONTENT_BANK[number], narrator: string): string {
  const cityMeta = CITY_META[fact.city];
  const cityName = cityMeta?.name || fact.city;
  const emoji = cityMeta?.emoji || '';

  if (narrator === 'buster') {
    // Buster voice: energetic, exclamation marks, adventure-oriented
    const intros = [
      `Hey friends! 🐾 ${fact.headline}`,
      `You gotta check this out! ${fact.headline}`,
      `Just discovered something awesome in ${cityName}! ${fact.headline}`,
      `${cityName} never stops surprising me! ${fact.headline}`,
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];
    return `${intro}\n\n${fact.body}\n\nLet's go check it out! 🐾\n\nDiscover more at pawcities.com/${cityMeta?.slug || fact.city}\n\nFollow @thepawcities for daily dog-friendly adventures! 🌍\n\n#PawCities #DogFriendly${cityName.replace(/\s/g, '')} #${cityName.replace(/\s/g, '')}Dogs #DogsOfInstagram #DogFriendly #DogLife`;
  }

  if (narrator === 'marley') {
    // Marley voice: calm, clever, knowing
    const intros = [
      `${emoji} Here's something most people don't know about ${cityName}...`,
      `Bet you didn't know this about ${cityName}. 🐾`,
      `${cityName} fun fact for your feed...`,
      `A little ${cityName} wisdom for today...`,
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];
    return `${intro}\n\n${fact.headline}: ${fact.body}\n\nThe more you know. 🧠🐾\n\nMore tips at pawcities.com/${cityMeta?.slug || fact.city}\n\nFollow @thepawcities for daily dog-friendly facts! 🌍\n\n#PawCities #DogFriendly${cityName.replace(/\s/g, '')} #${cityName.replace(/\s/g, '')}Dogs #DogsOfInstagram #DogFact #FunFact #DogLife`;
  }

  // Both / fallback
  return generateCaption(fact);
}

// ─── Build DALL-E prompt from content ─────────────────────────────────────────

const CITY_LANDMARKS: Record<string, { landmark: string; activity_buster: string; setting_marley: string }> = {
  paris: { landmark: 'the Eiffel Tower peeking above Parisian rooftops', activity_buster: 'sitting at a sidewalk café with a croissant', setting_marley: 'a cozy Parisian café window seat' },
  geneva: { landmark: 'the Jet d\'Eau fountain on Lake Geneva', activity_buster: 'trotting along the lakeside promenade', setting_marley: 'a Swiss train window seat overlooking Lake Geneva and the Alps' },
  london: { landmark: 'Tower Bridge', activity_buster: 'walking happily along the Thames', setting_marley: 'a warm pub corner with a fireplace' },
  barcelona: { landmark: 'the Sagrada Familia basilica', activity_buster: 'playing in a sunny park', setting_marley: 'a sunny terrace overlooking the Gothic Quarter' },
  losangeles: { landmark: 'the Hollywood sign in the distance', activity_buster: 'hiking on a trail in the California sunshine', setting_marley: 'a breezy beachside patio' },
  nyc: { landmark: 'the Central Park skyline', activity_buster: 'running through an open meadow', setting_marley: 'a cozy Brooklyn brownstone window' },
  sydney: { landmark: 'the Sydney Opera House', activity_buster: 'sitting on the harbour steps', setting_marley: 'a waterfront café with harbour views' },
  tokyo: { landmark: 'the Shibuya Crossing', activity_buster: 'sitting near the Hachiko statue', setting_marley: 'a traditional Japanese tea house' },
};

function buildImagePrompt(fact: typeof CONTENT_BANK[number], narrator: string): string {
  const cityMeta = CITY_META[fact.city];
  const cityName = cityMeta?.name || fact.city;
  const landmarks = CITY_LANDMARKS[fact.city] || CITY_LANDMARKS.paris;

  if (narrator === 'buster') {
    return `Pixar/Disney-style cartoon illustration: Buster, a small compact stocky mixed breed dog with a short smooth golden-honey coat, broad round face, warm expressive dark brown eyes, floppy rose-shaped ears that fold down, dark nose, wide happy grin with tongue hanging out. He wears an olive-green collar with a small orange paw-print tag. He is ${landmarks.activity_buster} in front of ${landmarks.landmark} in ${cityName}. Bright, colorful, cinematic with warm lighting. Background shows recognizable ${cityName} architecture. Instagram square format 1080x1080. No text overlay, no humans.`;
  }

  if (narrator === 'marley') {
    return `Pixar/Disney-style cartoon illustration: Marley, a medium-sized shaggy cockapoo-type dog with a wavy tousled cream-white coat with golden highlights, long scruffy fur around face and ears, soulful dark eyes peeking through a curtain of facial fur, dark nose partially hidden by shaggy fur, gentle wise expression. He wears a navy blue bandana with a small orange paw-print tag. He is relaxing in ${landmarks.setting_marley} in ${cityName}. Soft warm lighting, cozy atmosphere. Background hints at ${cityName} culture. Instagram square format 1080x1080. No text overlay, no humans.`;
  }

  // Both
  return `Pixar/Disney-style cartoon illustration: Two cartoon dogs together in ${cityName}. On the left: Buster, a small stocky dog with short smooth golden-honey coat, broad round face, floppy rose ears, big happy grin with tongue out, olive-green collar with orange paw tag. On the right: Marley, a medium shaggy cream-white cockapoo with tousled wavy fur, scruffy face, gentle wise eyes peeking through facial fur, navy blue bandana with orange paw tag. They are ${landmarks.activity_buster} with ${landmarks.landmark} in the background. Warm lighting, bright colors. 1080x1080, no text, no humans.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET  — List creative queue items
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // pending_review, approved, posted, etc.
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = supabase
    .from('creative_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also get counts by status
  const statusCounts: Record<string, number> = {};
  for (const s of ['generating', 'pending_review', 'approved', 'rejected', 'posted', 'failed']) {
    const { count } = await supabase
      .from('creative_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', s);
    statusCounts[s] = count || 0;
  }

  return NextResponse.json({ items: data || [], counts: statusCounts });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Generate new creatives (batch or single)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const body = await request.json();
  const { action } = body;

  // ── Action: Generate a batch of creatives from content bank ─────────────────
  if (action === 'generate_batch') {
    const count = Math.min(body.count || 7, 14); // Max 2 weeks worth

    // Get already-posted headlines
    const { data: posted } = await supabase
      .from('social_posts')
      .select('headline')
      .eq('status', 'published');
    const postedHeadlines = new Set((posted || []).map((p: { headline: string }) => p.headline));

    // Get already-queued headlines (so we don't duplicate)
    const { data: queued } = await supabase
      .from('creative_queue')
      .select('headline')
      .in('status', ['pending_review', 'approved', 'generating']);
    const queuedHeadlines = new Set((queued || []).map((q: { headline: string }) => q.headline));

    const generated: { headline: string; city: string; narrator: string }[] = [];
    const combined = new Set([...postedHeadlines, ...queuedHeadlines]);

    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    // Seed narrator alternation based on last posted/queued narrator
    const { data: lastNarrator } = await supabase
      .from('creative_queue')
      .select('narrator')
      .in('status', ['approved', 'posted', 'pending_review'])
      .order('scheduled_for', { ascending: false })
      .limit(1);
    // If the last one was marley, start with buster (index 0), and vice versa
    batchNarratorIndex = (lastNarrator?.[0]?.narrator === 'buster') ? 1 : 0;

    for (let i = 0; i < count; i++) {
      const fact = pickNextContent(combined);
      if (!fact) break;

      combined.add(fact.headline);
      const factIndex = CONTENT_BANK.indexOf(fact);
      const cityMeta = CITY_META[fact.city];
      const cityName = cityMeta?.name || fact.city;
      const citySlug = cityMeta?.slug || fact.city;

      // ── Visual Style Routing ──────────────────────────────────────────
      // Route content to the right visual approach based on type
      const visualStyle: VisualStyle = getVisualStyle(fact.type);

      // Narrator assignment: only needed for mascot style
      const narrator = shouldUseMascot(fact.type) ? assignNarrator(fact.type) : 'buster';

      // Determine scheduled date (today + i days)
      const schedDate = new Date();
      schedDate.setDate(schedDate.getDate() + i);
      const scheduledFor = schedDate.toISOString().split('T')[0];

      // ── Caption Generation (style-aware) ──────────────────────────────
      const captionStyle = getCaptionStyle(visualStyle);
      let caption: string;
      if (captionStyle === 'character' && hasOpenAI) {
        // Mascot posts: use character voice (Buster/Marley personality)
        const aiCaption = await generateCharacterCaption(
          narrator as 'buster' | 'marley' | 'both',
          fact.headline,
          fact.body,
          cityName,
          citySlug,
          fact.type,
        );
        caption = aiCaption || rewriteCaption(fact, narrator);
      } else if (captionStyle === 'informational' || captionStyle === 'complementary') {
        // Photo/text card posts: clean informational caption, no character voice
        const typeEmoji = fact.type === 'spotlight' ? '⭐' : fact.type === 'event' ? '📅' : fact.type === 'tip' ? '💡' : fact.type === 'guide' ? '📍' : '🐾';
        caption = `${typeEmoji} ${fact.headline}\n\n${fact.body}\n\nDiscover more at pawcities.com/${citySlug}\n\nFollow @thepawcities for daily dog-friendly content! 🌍\n\n#PawCities #DogFriendly${cityName.replace(/\s/g, '')} #DogsOfInstagram #DogFriendly #DogLife`;
      } else {
        caption = rewriteCaption(fact, narrator);
      }

      // ── Image Generation (style-aware) ─────────────────────────────────
      let imageUrl: string | null = null;
      let imagePrompt: string | null = null;

      if (visualStyle === 'mascot' && hasOpenAI) {
        // DALL-E mascot illustration — only for did-you-know and fun types
        imagePrompt = buildImagePrompt(fact, narrator);
        const storagePath = `mascot-creatives/${fact.city}-${narrator}-${factIndex}-${Date.now()}.png`;
        const dalleResult = await generateAndUploadMascotImage(imagePrompt, storagePath);
        if (dalleResult) {
          imageUrl = dalleResult.publicUrl;
        }
      } else if (visualStyle === 'photo' && fact.placeName) {
        // Real photo via Google Places — for spotlights with a specific business
        // Image will be fetched at post time via the photo proxy
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
        try {
          // Search for the place and get a photo
          const { searchPlace } = await import('@/lib/google-places');
          const result = await searchPlace(fact.placeName);
          if (result?.photos?.[0]?.name) {
            imageUrl = `${baseUrl}/api/places/photo?name=${encodeURIComponent(result.photos[0].name)}&maxWidth=1080`;
          }
        } catch {
          console.log(`[CREATIVE] Could not fetch photo for "${fact.placeName}", will use text card fallback`);
        }
      }
      // text_card and photo fallback: image generated at post time via OG endpoints
      // Store null imageUrl — the social-post cron will generate via the right endpoint

      const { error: insertError } = await supabase.from('creative_queue').insert({
        content_type: 'content_bank',
        content_index: factIndex,
        narrator,
        city: fact.city,
        headline: fact.headline,
        caption,
        image_url: imageUrl,
        image_prompt: imagePrompt,
        format: visualStyle,  // 'mascot', 'photo', or 'text_card'
        status: 'pending_review',
        scheduled_for: scheduledFor,
        generation_model: visualStyle === 'mascot' && hasOpenAI ? 'gpt-image-1' : 'next-og',
      });

      if (!insertError) {
        generated.push({ headline: fact.headline, city: fact.city, narrator });
      }
    }

    return NextResponse.json({
      success: true,
      generated: generated.length,
      items: generated,
      model: hasOpenAI ? 'dall-e-3 + gpt-4o-mini' : 'template (no OpenAI key)',
    });
  }

  // ── Action: Generate creative for a specific event ─────────────────────────
  if (action === 'generate_event') {
    const { eventId } = body;
    if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, cities(slug, name)')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if a creative already exists for this event
    const { data: existingCreative } = await supabase
      .from('creative_queue')
      .select('id, status')
      .eq('event_id', eventId)
      .in('status', ['pending_review', 'approved', 'generating'])
      .limit(1);

    if (existingCreative && existingCreative.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Creative already exists for this event (status: ${existingCreative[0].status})`,
        existingId: existingCreative[0].id,
      }, { status: 409 });
    }

    const cityName = event.cities?.name || 'City';
    const citySlug = event.cities?.slug || 'losangeles';
    const metaKey = Object.keys(CITY_META).find(k => CITY_META[k].slug === citySlug) || citySlug;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    // ── PHOTO-FIRST strategy for events ─────────────────────────────────
    // Events use real photography or cityscape overlays — NOT mascots.
    // This looks professional for sponsors and clearly communicates
    // "real event happening on a real date."

    // Build clean, informational caption (no character voice for events)
    const allHandles = event.mentioned_handles || [];
    const handleMentions = allHandles.length > 0
      ? `\n\n${allHandles.map((h: string) => '@' + h.replace('@', '')).join(' ')}`
      : '';
    const sourceMention = event.source_handle
      ? `\nvia @${event.source_handle.replace('@', '')}`
      : '';

    const freeTag = event.is_free ? '🆓 Free event!\n\n' : '';
    const caption = `📅 ${event.name}\n\n🗓 ${event.start_date}${event.venue_name ? `\n📍 ${event.venue_name}` : ''}\n\n${event.description || 'Don\'t miss this dog-friendly event!'}\n\n${freeTag}Find more events at pawcities.com/${citySlug}${handleMentions}${sourceMention}\n\nFollow @thepawcities for dog-friendly events worldwide 🌍\n\n#PawCities #DogFriendlyEvents #DogEvents #DogsOfInstagram #${cityName.replace(/\s/g, '')}`;

    // ── Branded event creative with dog photography ──────────────────────
    // Always use our OG event-creative endpoint: dog photo background with
    // event name, date, and venue overlaid. Consistent, on-brand look.
    let imageUrl: string | null = null;
    const imagePrompt: string | null = null;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const dateStr = new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const ogParams = new URLSearchParams({
        name: event.name,
        city: cityName,
        citySlug,
        date: dateStr,
        ...(event.venue_name ? { venue: event.venue_name } : {}),
        ...(event.is_free ? { free: 'true' } : {}),
      });
      const ogUrl = `${baseUrl}/api/social/event-creative?${ogParams}`;
      const ogRes = await fetch(ogUrl, { signal: AbortSignal.timeout(20000) });
      if (ogRes.ok) {
        const imgBuffer = Buffer.from(await ogRes.arrayBuffer());
        const safeName = event.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
        const storagePath = `event-creatives/${citySlug}-${safeName}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath);
          imageUrl = urlData?.publicUrl || null;
        }
      }
    } catch (err) {
      console.log(`[CREATIVE] OG event-creative generation failed for "${event.name}":`, err);
    }
    // If OG endpoint fails, imageUrl stays null — social-post cron will generate at post time

    const { error: insertError } = await supabase.from('creative_queue').insert({
      content_type: 'event',
      event_id: eventId,
      narrator: Math.random() > 0.5 ? 'buster' : 'marley',  // Alternate narrators for feed variety
      city: metaKey,
      headline: event.name,
      caption,
      image_url: imageUrl,
      image_prompt: imagePrompt,
      format: 'photo',  // Photo-based visual style
      status: 'pending_review',
      // Schedule 3 days before the event so followers can plan ahead
      scheduled_for: (() => {
        const eventDate = new Date(event.start_date + 'T00:00:00Z');
        eventDate.setUTCDate(eventDate.getUTCDate() - 3);
        return eventDate.toISOString().split('T')[0];
      })(),
      generation_model: 'photo-first',
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: event.name,
      city: cityName,
      format: 'photo',
      hasImage: !!imageUrl,
      message: `Creative generated for "${event.name}" — review at /admin/creatives`,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH — Update a creative (approve, reject, edit caption, regenerate)
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const body = await request.json();
  const { id, action } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // ── Approve ──────────────────────────────────────────────────────────────────
  if (action === 'approve') {
    const { error } = await supabase
      .from('creative_queue')
      .update({ status: 'approved' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: 'approved' });
  }

  // ── Reject ───────────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const { error } = await supabase
      .from('creative_queue')
      .update({ status: 'rejected', rejection_reason: body.reason || null })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: 'rejected' });
  }

  // ── Edit caption ─────────────────────────────────────────────────────────────
  if (action === 'edit') {
    const updates: Record<string, string> = {};
    if (body.caption) updates.caption = body.caption;
    if (body.headline) updates.headline = body.headline;
    if (body.narrator) updates.narrator = body.narrator;
    if (body.scheduled_for) updates.scheduled_for = body.scheduled_for;

    const { error } = await supabase
      .from('creative_queue')
      .update(updates)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: Object.keys(updates) });
  }

  // ── Regenerate image ────────────────────────────────────────────────────────
  if (action === 'regenerate') {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'No OPENAI_API_KEY configured' }, { status: 400 });
    }

    // Fetch the creative to get its prompt
    const { data: creative } = await supabase
      .from('creative_queue')
      .select('image_prompt, city, narrator, content_index')
      .eq('id', id)
      .single();

    if (!creative?.image_prompt) {
      return NextResponse.json({ error: 'No image prompt found' }, { status: 404 });
    }

    const storagePath = `mascot-creatives/${creative.city}-${creative.narrator}-regen-${Date.now()}.png`;
    const dalleResult = await generateAndUploadMascotImage(creative.image_prompt, storagePath);

    if (!dalleResult) {
      return NextResponse.json({ error: 'DALL-E generation failed' }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from('creative_queue')
      .update({ image_url: dalleResult.publicUrl })
      .eq('id', id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ success: true, image_url: dalleResult.publicUrl });
  }

  // ── Approve all pending ──────────────────────────────────────────────────────
  if (action === 'approve_all') {
    const { error, count } = await supabase
      .from('creative_queue')
      .update({ status: 'approved' })
      .eq('status', 'pending_review');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, approved: count });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

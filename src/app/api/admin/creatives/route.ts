import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CONTENT_BANK,
  CITY_META,
  generateCaption,
  pickNextContent,
} from '@/lib/social-content';
import { generateAndUploadMascotImage, generateCharacterCaption } from '@/lib/dalle';

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
    return `Pixar/Disney-style cartoon illustration: Buster, a compact golden-tan smooth-coated mixed breed dog with folded ears, big expressive brown eyes, wide happy grin with tongue out, wearing an olive-green collar with a small orange paw-print tag, ${landmarks.activity_buster} in front of ${landmarks.landmark} in ${cityName}. Bright, colorful, cinematic with warm lighting. Background shows recognizable ${cityName} architecture. Instagram square format 1080x1080. No text overlay, no humans.`;
  }

  if (narrator === 'marley') {
    return `Pixar/Disney-style cartoon illustration: Marley, a fluffy golden-apricot goldendoodle with curly teddy bear coat, soulful intelligent brown eyes, calm gentle smile, wearing a navy blue bandana with a small orange paw-print tag, relaxing in ${landmarks.setting_marley} in ${cityName}. Soft warm lighting, cozy atmosphere. Background hints at ${cityName} culture. Instagram square format 1080x1080. No text overlay, no humans.`;
  }

  // Both
  return `Pixar/Disney-style cartoon illustration: Two cartoon dogs together in ${cityName}. On the left: Buster, a compact golden-tan smooth-coated dog with folded ears, happy grin, olive-green collar with orange paw tag. On the right: Marley, a fluffy golden-apricot goldendoodle with curly coat, calm smile, navy blue bandana with orange paw tag. They are ${landmarks.activity_buster} with ${landmarks.landmark} in the background. Warm lighting, bright colors. 1080x1080, no text, no humans.`;
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
      const narrator = assignNarrator(fact.type);
      const imagePrompt = buildImagePrompt(fact, narrator);
      const cityMeta = CITY_META[fact.city];

      // Determine scheduled date (today + i days)
      const schedDate = new Date();
      schedDate.setDate(schedDate.getDate() + i);
      const scheduledFor = schedDate.toISOString().split('T')[0];

      // Try GPT-4o for character-voice caption, fall back to template
      let caption: string;
      if (hasOpenAI) {
        const aiCaption = await generateCharacterCaption(
          narrator as 'buster' | 'marley' | 'both',
          fact.headline,
          fact.body,
          cityMeta?.name || fact.city,
          cityMeta?.slug || fact.city,
          fact.type,
        );
        caption = aiCaption || rewriteCaption(fact, narrator);
      } else {
        caption = rewriteCaption(fact, narrator);
      }

      // Try DALL-E 3 for mascot image
      let imageUrl: string | null = null;
      if (hasOpenAI) {
        const storagePath = `mascot-creatives/${fact.city}-${narrator}-${factIndex}-${Date.now()}.png`;
        const dalleResult = await generateAndUploadMascotImage(imagePrompt, storagePath);
        if (dalleResult) {
          imageUrl = dalleResult.publicUrl;
        }
      }

      const { error: insertError } = await supabase.from('creative_queue').insert({
        content_type: 'content_bank',
        content_index: factIndex,
        narrator,
        city: fact.city,
        headline: fact.headline,
        caption,
        image_url: imageUrl,
        image_prompt: imagePrompt,
        format: 'city_card',
        status: 'pending_review',
        scheduled_for: scheduledFor,
        generation_model: hasOpenAI ? 'gpt-image-1' : 'next-og',
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

    const cityName = event.cities?.name || 'City';
    const citySlug = event.cities?.slug || 'losangeles';
    const metaKey = Object.keys(CITY_META).find(k => CITY_META[k].slug === citySlug) || citySlug;

    const narrator = 'buster'; // Buster handles events
    const landmarks = CITY_LANDMARKS[metaKey] || CITY_LANDMARKS.paris;

    const imagePrompt = `Pixar/Disney-style cartoon illustration: Buster, a compact golden-tan smooth-coated mixed breed dog with folded ears, big expressive brown eyes, wide happy grin with tongue out, wearing an olive-green collar with orange paw tag, standing excitedly in ${cityName}. Behind him, ${landmarks.landmark}. Bright cheerful atmosphere suggesting a fun dog-friendly event. 1080x1080, no text, no humans.`;

    const caption = `📅 ${event.name} in ${cityName}!\n\n🗓 ${event.start_date}\n📍 ${event.venue_name || cityName}\n\n${event.description || 'Don\'t miss this awesome dog-friendly event!'}\n\n${event.is_free ? '🆓 Free event!\n\n' : ''}Find more dog-friendly events at pawcities.com/events\n\nFollow @thepawcities for daily dog-friendly events 🌍\n\n#PawCities #DogFriendlyEvents #DogEvents #DogsOfInstagram #${cityName.replace(/\s/g, '')}`;

    const { error: insertError } = await supabase.from('creative_queue').insert({
      content_type: 'event',
      event_id: eventId,
      narrator,
      city: metaKey,
      headline: event.name,
      caption,
      image_prompt: imagePrompt,
      format: 'event_post',
      status: 'pending_review',
      scheduled_for: event.start_date,
      generation_model: process.env.OPENAI_API_KEY ? 'gpt-image-1' : 'next-og',
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: event.name, city: cityName });
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

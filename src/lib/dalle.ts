import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// ─── OpenAI Client ──────────────────────────────────────────────────────────

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Generate image with DALL-E 3 ──────────────────────────────────────────

export async function generateMascotImage(
  prompt: string,
  options?: { size?: '1024x1024' | '1792x1024' | '1024x1792'; quality?: 'low' | 'medium' | 'high' }
): Promise<{ buffer: Buffer; revised_prompt: string } | null> {
  const openai = getOpenAI();
  if (!openai) {
    console.log('[DALLE] No OPENAI_API_KEY configured, skipping image generation');
    return null;
  }

  try {
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: options?.size || '1024x1024',
      quality: options?.quality || 'high',
    });

    // gpt-image-1 returns base64 data
    const b64 = response.data[0]?.b64_json;
    const revisedPrompt = response.data[0]?.revised_prompt || '';

    if (b64) {
      return { buffer: Buffer.from(b64, 'base64'), revised_prompt: revisedPrompt };
    }

    // Fallback: try URL-based response
    const imageUrl = response.data[0]?.url;
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return { buffer: buf, revised_prompt: revisedPrompt };
      }
    }

    console.error('[DALLE] No image data in response');
    return null;
  } catch (error) {
    console.error('[DALLE] Generation failed:', error);
    return null;
  }
}

// ─── Generate and upload to Supabase Storage ────────────────────────────────

export async function generateAndUploadMascotImage(
  prompt: string,
  storagePath: string,
  options?: { size?: '1024x1024' | '1792x1024' | '1024x1792'; quality?: 'low' | 'medium' | 'high' }
): Promise<{ publicUrl: string; revised_prompt: string } | null> {
  // Step 1: Generate image (returns buffer directly)
  const result = await generateMascotImage(prompt, options);
  if (!result) return null;

  // Step 2: Upload to Supabase Storage
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[DALLE] No Supabase client');
    return null;
  }

  try {
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(storagePath, result.buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[DALLE] Supabase upload failed:', uploadError.message);
      return null;
    }

    // Step 4: Get public URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      console.error('[DALLE] Failed to get public URL');
      return null;
    }

    console.log(`[DALLE] Image generated and uploaded: ${urlData.publicUrl}`);
    return { publicUrl: urlData.publicUrl, revised_prompt: result.revised_prompt };
  } catch (error) {
    console.error('[DALLE] Upload pipeline failed:', error);
    return null;
  }
}

// ─── City language & culture context ─────────────────────────────────────────

const CITY_CULTURE: Record<string, {
  language: string;
  localGreeting: string;
  localDogWord: string;
  culturalFlavor: string;
  hashtagLanguage: string[];
}> = {
  paris: {
    language: 'French',
    localGreeting: 'Bonjour',
    localDogWord: 'chien',
    culturalFlavor: 'Parisian café culture, sidewalk terraces, elegant dog-friendly bistros, Sunday strolls along the Seine',
    hashtagLanguage: ['ChienDeParis', 'ParisCanin', 'ChienFriendly'],
  },
  london: {
    language: 'English (British)',
    localGreeting: 'Cheers',
    localDogWord: 'dog',
    culturalFlavor: 'cozy pubs with dog blankets, Royal Parks, canal-side walks, proper British charm',
    hashtagLanguage: ['LondonDogs', 'DogFriendlyUK', 'DogsOfLondon'],
  },
  barcelona: {
    language: 'Spanish/Catalan',
    localGreeting: 'Hola',
    localDogWord: 'perro/gos',
    culturalFlavor: 'beach culture, tapas bars, Gothic Quarter charm, Barceloneta promenade, warm Mediterranean vibes',
    hashtagLanguage: ['PerroBarcelona', 'GosBarcelona', 'DogFriendlyBCN'],
  },
  losangeles: {
    language: 'English',
    localGreeting: 'Hey',
    localDogWord: 'pup',
    culturalFlavor: 'beach vibes, hiking trails, outdoor brunch culture, dog-friendly patios, SoCal sunshine',
    hashtagLanguage: ['DogsOfLA', 'DogFriendlyLA', 'SoCalDogs'],
  },
  nyc: {
    language: 'English',
    localGreeting: 'Hey',
    localDogWord: 'dog',
    culturalFlavor: 'Central Park dog runs, Brooklyn brownstone charm, rooftop bars, neighborhood dog culture, bodega cats but dog people',
    hashtagLanguage: ['DogsOfNYC', 'NYCDogs', 'DogFriendlyNYC'],
  },
  sydney: {
    language: 'English (Australian)',
    localGreeting: 'G\'day',
    localDogWord: 'dog/pupper',
    culturalFlavor: 'beach walks, harbour-side cafés, off-leash parks, outdoor barbecue culture, Bondi vibes',
    hashtagLanguage: ['DogsOfSydney', 'DogFriendlyAus', 'SydneyDogs'],
  },
  tokyo: {
    language: 'Japanese',
    localGreeting: 'こんにちは',
    localDogWord: 'わんこ/犬',
    culturalFlavor: 'dog cafés, Yoyogi Park gatherings, Hachiko spirit, kawaii culture, impeccable grooming, seasonal festivals',
    hashtagLanguage: ['東京犬', 'ドッグイベント', 'わんこ'],
  },
  geneva: {
    language: 'French/German',
    localGreeting: 'Bonjour/Grüezi',
    localDogWord: 'chien/Hund',
    culturalFlavor: 'lakeside promenades, Swiss precision and charm, mountain backdrop, trilingual community, clean parks',
    hashtagLanguage: ['ChiensSuisses', 'SwissDogs', 'GenevaChien'],
  },
};

// ─── AI Event Enrichment (quality gate) ──────────────────────────────────────

export interface EnrichedEvent {
  name: string;
  description: string;
  venueName: string | null;
  venueAddress: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  city: string | null;
  tags: string[];
  isFree: boolean;
  sourceHandle: string | null;
  mentionedHandles: string[];
  externalUrl: string | null;
  qualityScore: number;
  qualityIssues: string[];
  localLanguageNote: string | null;
}

/**
 * Uses GPT to enrich a raw event discovery from Instagram.
 * Extracts structured data, identifies businesses/sponsors,
 * checks completeness, and adds local cultural context.
 */
export async function enrichEventWithAI(
  rawCaption: string,
  sourceUsername: string,
  hintCity: string | null,
  permalink: string | null,
): Promise<EnrichedEvent | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a data extraction specialist for PawCities, a dog-friendly city guide. Extract event information from Instagram posts. Be thorough about identifying businesses, venues, and sponsors — their Instagram handles are extremely valuable to us.

CRITICAL RULES:
- Extract ALL @handles mentioned in the caption — these are businesses, venues, organizers, sponsors
- Distinguish the source/organizer handle from mentioned/sponsor handles
- Detect the language of the caption and note the city appropriately
- If the post is in French, Spanish, Japanese, German, or Catalan, translate the event name and description to English but note the original language
- Score the event's completeness and quality (0-100)
- Flag any missing critical fields

Respond ONLY with valid JSON, no markdown fences.`
        },
        {
          role: 'user',
          content: `Extract event details from this Instagram post.

Source account: @${sourceUsername}
Hint city: ${hintCity || 'unknown'}
Caption:
${rawCaption.substring(0, 1500)}

Return JSON with these exact fields:
{
  "name": "event name in English",
  "originalName": "event name in original language if non-English, else null",
  "description": "brief English description (1-2 sentences)",
  "venueName": "venue or location name, or null",
  "venueAddress": "address if mentioned, or null",
  "date": "YYYY-MM-DD if found, or null",
  "startTime": "HH:MM:SS if found, or null",
  "endTime": "HH:MM:SS if found, or null",
  "city": "one of: paris, london, barcelona, losangeles, nyc, sydney, tokyo, geneva — or null",
  "tags": ["relevant", "tags"],
  "isFree": true/false,
  "sourceHandle": "@organizer_handle",
  "mentionedHandles": ["@sponsor1", "@venue", "@partner"],
  "externalUrl": "url if found, or null",
  "isActualEvent": true/false,
  "language": "detected language of caption",
  "qualityScore": 0-100,
  "qualityIssues": ["missing date", "no venue"],
  "localLanguageNote": "a fun phrase in the local language relating to dogs, or null if English"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    // Parse JSON (handle potential markdown wrapping)
    const jsonStr = content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(jsonStr);

    if (!parsed.isActualEvent) {
      console.log(`[ENRICH] Skipped non-event post from @${sourceUsername}`);
      return null;
    }

    return {
      name: parsed.name || null,
      description: parsed.description || null,
      venueName: parsed.venueName || null,
      venueAddress: parsed.venueAddress || null,
      date: parsed.date || null,
      startTime: parsed.startTime || null,
      endTime: parsed.endTime || null,
      city: parsed.city || hintCity,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      isFree: !!parsed.isFree,
      sourceHandle: parsed.sourceHandle?.replace('@', '') || sourceUsername,
      mentionedHandles: Array.isArray(parsed.mentionedHandles)
        ? parsed.mentionedHandles.map((h: string) => h.replace('@', ''))
        : [],
      externalUrl: parsed.externalUrl || permalink,
      qualityScore: typeof parsed.qualityScore === 'number' ? parsed.qualityScore : 30,
      qualityIssues: Array.isArray(parsed.qualityIssues) ? parsed.qualityIssues : [],
      localLanguageNote: parsed.localLanguageNote || null,
    };
  } catch (error) {
    console.error('[ENRICH] AI enrichment failed:', error);
    return null;
  }
}

// ─── Generate caption with GPT-4o in character voice ────────────────────────

export async function generateCharacterCaption(
  narrator: 'buster' | 'marley' | 'both',
  headline: string,
  body: string,
  city: string,
  citySlug: string,
  contentType: string,
): Promise<string | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const culture = CITY_CULTURE[citySlug] || CITY_CULTURE[city.toLowerCase()] || null;

  const busterVoice = `You are Buster, a compact golden-tan mixed breed dog with an olive-green collar. You're the adventure-loving half of the PawCities mascot duo. You're energetic, warm, excitable, and a bit goofy — the friend who's always first out the door. You speak with genuine enthusiasm, not corporate cheerfulness.

Your personality:
- You get genuinely EXCITED about events and places
- You use playful language, puns when they're natural (not forced)
- You talk like a real friend sharing a discovery, not a marketing bot
- You naturally vary your openings — don't always start the same way
- You tag and shout out businesses and sponsors enthusiastically because you genuinely appreciate them
${culture ? `- For ${city}, sprinkle in occasional ${culture.language} words/phrases naturally (like "${culture.localGreeting}!" or calling dogs "${culture.localDogWord}")` : ''}
${culture ? `- Reference ${culture.culturalFlavor} for authentic local color` : ''}

Keep it under 160 words. Be CREATIVE — never repeat the same opener twice.`;

  const marleyVoice = `You are Marley, a fluffy golden-apricot goldendoodle with a navy blue bandana. You're the thoughtful, clever half of the PawCities mascot duo. You deliver insights with a knowing smile and dry wit. You're the one who notices the interesting details others miss.

Your personality:
- You share discoveries with calm confidence, like a well-traveled friend
- You use clever wordplay and subtle humor, never try-hard jokes
- You appreciate the craft behind what businesses and organizers do — you name-drop them with genuine respect
- You vary your style: sometimes a story, sometimes a fact, sometimes a recommendation
- You're not above a good pun, but you'd never admit it
${culture ? `- For ${city}, weave in ${culture.language} phrases that show you actually know the culture (like "${culture.localGreeting}" or local expressions)` : ''}
${culture ? `- Draw on ${culture.culturalFlavor} for authentic atmosphere` : ''}

Keep it under 160 words. Be CREATIVE — never sound formulaic.`;

  const bothVoice = `You are writing for both Buster (enthusiastic adventurer with olive-green collar) and Marley (calm clever goldendoodle with navy bandana). Give each a distinct voice. Keep it under 200 words.`;

  const systemPrompt = narrator === 'buster' ? busterVoice : narrator === 'marley' ? marleyVoice : bothVoice;

  // Extract @handles from the body text for inclusion
  const handleMatches = body.match(/@([a-zA-Z0-9_.]+)/g) || [];
  const handles = handleMatches
    .map(h => h.replace('@', ''))
    .filter(h => h.toLowerCase() !== 'thepawcities');
  const handleInstruction = handles.length > 0
    ? `\n- MUST @mention these businesses/sponsors naturally in the caption: ${handles.map(h => '@' + h).join(', ')}`
    : '';

  // Build city-specific hashtags
  const cultureHashtags = culture?.hashtagLanguage?.slice(0, 2).map(h => '#' + h).join(' ') || '';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Write an Instagram caption for a dog-friendly ${contentType} post about ${city}.

Headline: ${headline}
Details: ${body}

Requirements:
- Write in your character's voice — be CREATIVE and FUN, not generic
- Open with something unique (NOT "Hey pack" or "Did you know" every time — vary it!)
- Include the event/place details naturally, don't just list them${handleInstruction}
- End with a CTA to pawcities.com/${citySlug}${contentType === 'event' ? '/events' : ''}
- Add "Follow @thepawcities for more dog-friendly adventures!"
- Include 8-12 relevant hashtags (always include #PawCities #DogsOfInstagram, plus ${cultureHashtags || 'city-specific tags'})
- Use 2-3 emojis naturally, placed where they enhance the text
${culture ? `- Include 1-2 ${culture.language} words/phrases for authentic local flavor` : ''}
- NO quotation marks around the entire caption
- Do NOT start with the same opener you used last time — be fresh!`
        }
      ],
      temperature: 0.9,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('[GPT] Caption generation failed:', error);
    return null;
  }
}

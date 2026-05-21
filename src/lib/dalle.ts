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
  options?: { size?: '1024x1024' | '1792x1024' | '1024x1792'; quality?: 'standard' | 'hd' }
): Promise<{ url: string; revised_prompt: string } | null> {
  const openai = getOpenAI();
  if (!openai) {
    console.log('[DALLE] No OPENAI_API_KEY configured, skipping image generation');
    return null;
  }

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: options?.size || '1024x1024',
      quality: options?.quality || 'standard',
      style: 'vivid',
    });

    const imageUrl = response.data[0]?.url;
    const revisedPrompt = response.data[0]?.revised_prompt || '';

    if (!imageUrl) {
      console.error('[DALLE] No image URL in response');
      return null;
    }

    return { url: imageUrl, revised_prompt: revisedPrompt };
  } catch (error) {
    console.error('[DALLE] Generation failed:', error);
    return null;
  }
}

// ─── Generate and upload to Supabase Storage ────────────────────────────────

export async function generateAndUploadMascotImage(
  prompt: string,
  storagePath: string,
  options?: { size?: '1024x1024' | '1792x1024' | '1024x1792'; quality?: 'standard' | 'hd' }
): Promise<{ publicUrl: string; revised_prompt: string } | null> {
  // Step 1: Generate with DALL-E
  const result = await generateMascotImage(prompt, options);
  if (!result) return null;

  // Step 2: Download the generated image
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[DALLE] No Supabase client');
    return null;
  }

  try {
    const imageRes = await fetch(result.url);
    if (!imageRes.ok) {
      console.error(`[DALLE] Failed to download generated image: HTTP ${imageRes.status}`);
      return null;
    }
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

    // Step 3: Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(storagePath, imageBuffer, {
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

  const busterVoice = `You are Buster, an enthusiastic adventure-loving dog. You're energetic, warm, a little goofy. You use exclamation marks and phrases like "Let's go check it out!" You love exploring dog-friendly cities and finding new spots. Keep it under 150 words.`;

  const marleyVoice = `You are Marley, a calm and clever goldendoodle. You deliver facts with a knowing smile and dry wit. You use phrases like "Bet you didn't know that." You're the brains of the duo — thoughtful, measured, with clever wordplay. Keep it under 150 words.`;

  const bothVoice = `You are writing for both Buster (enthusiastic adventurer) and Marley (calm clever fact-dropper). Include both their perspectives. Keep it under 200 words.`;

  const systemPrompt = narrator === 'buster' ? busterVoice : narrator === 'marley' ? marleyVoice : bothVoice;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Write an Instagram caption for a dog-friendly ${contentType} post about ${city}.

Headline: ${headline}
Fact: ${body}

Requirements:
- Write in your character's voice
- Include the fact naturally
- End with a CTA to pawcities.com/${citySlug}
- Add "Follow @thepawcities"
- Include 8-12 relevant hashtags at the end (always include #PawCities and #DogsOfInstagram)
- Use 1-2 emojis naturally, don't overdo it
- NO quotation marks around the entire caption`
        }
      ],
      temperature: 0.8,
      max_tokens: 400,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('[GPT] Caption generation failed:', error);
    return null;
  }
}

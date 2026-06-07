/**
 * Generate a special mascot introduction post for Buster & Marley
 * Run via: npx tsx scripts/generate-intro-post.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { generateAndUploadMascotImage, generateCharacterCaption } from '../src/lib/dalle';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log('🐾 Generating Buster & Marley Introduction Post...\n');

  // ── 1. Generate the hero image with DALL-E ──────────────────────────────────
  const imagePrompt = `Pixar/Disney-style cartoon illustration of two friendly cartoon dogs posing together for a group portrait, looking directly at the viewer with warm inviting expressions. On the left: Buster, a compact golden-tan smooth-coated mixed breed dog with soft folded ears, big sparkling expressive brown eyes, a wide happy grin with tongue peeking out, wearing an olive-green collar with a small bright orange paw-print tag. On the right: Marley, a fluffy golden-apricot goldendoodle with a luxurious curly teddy bear coat, soulful intelligent brown eyes, a calm gentle knowing smile, wearing a navy blue bandana with a small bright orange paw-print tag. They are sitting side by side on a sun-dappled cobblestone street in a charming European city, surrounded by pastel-colored buildings, flower boxes, and warm golden hour lighting. A small suitcase with travel stickers sits between them. The mood is adventurous, joyful, and inviting — like the opening scene of an animated movie about two dogs exploring the world. Vibrant colors, cinematic composition, soft depth of field on the background. Instagram square format 1080x1080. No text overlay, no humans, no watermarks.`;

  console.log('🎨 Generating DALL-E image (this takes ~30 seconds)...');
  const storagePath = `mascot-creatives/intro-buster-marley-hero-${Date.now()}.png`;
  const dalleResult = await generateAndUploadMascotImage(imagePrompt, storagePath, {
    size: '1024x1024',
    quality: 'high',
  });

  if (!dalleResult) {
    console.error('❌ DALL-E generation failed');
    process.exit(1);
  }
  console.log(`✅ Image generated: ${dalleResult.publicUrl}\n`);

  // ── 2. Generate introduction caption with GPT-4o ────────────────────────────
  console.log('✍️ Generating introduction caption...');

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const captionResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are writing the debut Instagram caption for two brand-new animated dog mascots: Buster and Marley. They are the new faces of @thepawcities — a platform that helps dog owners find the best dog-friendly places in cities around the world.

Buster is a compact golden-tan mixed breed. He's the adventurer — enthusiastic, a little goofy, always up for exploring new dog-friendly spots. He uses exclamation marks and phrases like "Let's go!"

Marley is a fluffy golden-apricot goldendoodle. He's the brains — calm, clever, drops knowledge with a knowing smile. Dry wit, smart wordplay, phrases like "Bet you didn't know that."

This is their FIRST ever post — an introduction to the world. Make it feel like an exciting debut. The caption should:
- Be written as if Buster and Marley are introducing themselves directly to followers
- Include both their personalities
- Mention they'll be sharing dog-friendly tips, hidden gems, and city adventures
- Be warm, fun, and make people want to follow
- End with a CTA to follow @thepawcities
- Include 10-12 hashtags at the end (always include #PawCities #DogsOfInstagram #DogFriendly)
- Use 2-3 emojis naturally
- Keep it under 250 words
- NO quotation marks around the entire caption`
      },
      {
        role: 'user',
        content: 'Write the debut introduction caption for Buster and Marley.'
      }
    ],
    temperature: 0.85,
    max_tokens: 500,
  });

  const caption = captionResponse.choices[0]?.message?.content?.trim();
  if (!caption) {
    console.error('❌ Caption generation failed');
    process.exit(1);
  }
  console.log(`✅ Caption generated (${caption.length} chars)\n`);
  console.log('--- CAPTION PREVIEW ---');
  console.log(caption);
  console.log('--- END PREVIEW ---\n');

  // ── 3. Insert into creative queue ───────────────────────────────────────────
  console.log('📥 Inserting into creative queue...');

  const today = new Date().toISOString().split('T')[0];

  const { data: creative, error: insertError } = await supabase.from('creative_queue').insert({
    content_type: 'custom',
    narrator: 'both',
    city: 'global',
    headline: 'Meet Buster & Marley — Your New Dog-Friendly City Guides!',
    caption,
    image_url: dalleResult.publicUrl,
    image_prompt: imagePrompt,
    format: 'intro',
    status: 'pending_review',
    scheduled_for: today,
    generation_model: 'gpt-image-1 + gpt-4o-mini',
  }).select().single();

  if (insertError) {
    console.error('❌ Insert error:', insertError.message);
    process.exit(1);
  }

  console.log(`✅ Creative queued with ID: ${creative.id}`);
  console.log(`📸 Image: ${dalleResult.publicUrl}`);
  console.log(`\n🎉 Introduction post is ready for review at:`);
  console.log(`   https://pawcities.com/admin/creatives\n`);
  console.log('Go approve it and it will be posted to Instagram! 🚀');
}

main().catch(console.error);

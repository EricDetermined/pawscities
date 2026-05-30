import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { publishImagePost } from '@/lib/instagram';
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
// Runs TWICE daily with slot preferences:
//   - 10:00 UTC  ?prefer=content_bank  → morning fun fact (Buster/Marley)
//   - 16:00 UTC  ?prefer=event         → afternoon event post (mascot creative)
//
// Each run posts exactly 1 item from creative_queue.
// The `prefer` param controls which content_type to try first:
//   - If preferred type has approved creatives → pick that
//   - If not → fall back to any approved creative
//   - If nothing → skip (no post this slot)
//
// All content flows through creative_queue with admin review:
//   - Content bank fun facts → batch generated → reviewed → approved
//   - Events → discovered → approved → mascot creative auto-generated → reviewed → approved
//   - Business spotlights → generated → reviewed → approved
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const prefer = request.nextUrl.searchParams.get('prefer'); // 'content_bank' | 'event' | null

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

    // ══════════════════════════════════════════════════════════════════════════
    // Fetch approved creatives — prefer the requested content_type if set
    //
    // Strategy:
    //   1. Try preferred type first (if set)
    //   2. Fall back to any approved creative
    //   This ensures we always post *something* even if the preferred
    //   type has nothing ready, while naturally splitting fun facts
    //   and events across morning/afternoon slots.
    // ══════════════════════════════════════════════════════════════════════════

    let approvedCreatives: Record<string, unknown>[] | null = null;

    // Step 1: Try preferred type
    if (prefer && ['content_bank', 'event'].includes(prefer)) {
      const { data } = await supabase
        .from('creative_queue')
        .select('*')
        .eq('status', 'approved')
        .eq('content_type', prefer)
        .lte('scheduled_for', today)
        .order('scheduled_for', { ascending: true })
        .limit(5);
      if (data && data.length > 0) {
        approvedCreatives = data;
        console.log(`[SOCIAL-POST] Slot=${slot}: Found ${data.length} preferred "${prefer}" creatives`);
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
        .limit(5);
      approvedCreatives = data;
      if (prefer && data && data.length > 0) {
        console.log(`[SOCIAL-POST] Slot=${slot}: No "${prefer}" creatives, falling back to ${data[0].content_type}`);
      }
    }

    if (!approvedCreatives || approvedCreatives.length === 0) {
      console.log(`[SOCIAL-POST] Slot=${slot}: No approved creatives scheduled for today`);
      return NextResponse.json({
        status: 'skipped',
        slot,
        reason: 'No approved creatives ready to post. Generate and approve content in /admin/creatives.',
      });
    }

    // Try each creative until one succeeds
    for (const creative of approvedCreatives) {
      console.log(`[SOCIAL-POST] Attempting: "${creative.headline}" (${creative.content_type}, ${creative.narrator})`);

      let imageUrl = creative.image_url as string | null;

      // ── Generate image if missing ────────────────────────────────────────
      if (!imageUrl) {
        if (creative.image_prompt && hasOpenAI) {
          // Use DALL-E to generate from the stored prompt
          const storagePath = `mascot-creatives/${creative.city}-${creative.content_type}-${creative.narrator}-${Date.now()}.png`;
          const dalleResult = await generateAndUploadMascotImage(creative.image_prompt as string, storagePath);
          if (dalleResult) {
            imageUrl = dalleResult.publicUrl;
          }
        } else if (creative.content_type === 'content_bank' && creative.content_index != null) {
          // Fallback: generate via next/og creative endpoint
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
            console.error(`[SOCIAL-POST] Creative generation failed:`, err);
          }
        } else if (creative.content_type === 'event' && creative.event_id) {
          // Fallback: generate event creative via endpoint
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
            try {
              const creativeRes = await fetch(`${getBaseUrl()}/api/social/event-creative?${creativeParams}`);
              if (creativeRes.ok) {
                const imgBuffer = Buffer.from(await creativeRes.arrayBuffer());
                const storagePath = `instagram-posts/${creative.city}-event-${Date.now()}.png`;
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
      const result = await publishImagePost(imageUrl as string, creative.caption as string);

      // ── Log to social_posts ──────────────────────────────────────────────
      const { data: postRow } = await supabase.from('social_posts').insert({
        platform: 'instagram',
        post_id: result.postId || null,
        container_id: result.containerId || null,
        headline: creative.headline,
        city: creative.city,
        caption: creative.caption,
        image_url: imageUrl,
        status: result.success ? 'published' : 'failed',
        error_message: result.error || null,
      }).select('id').single();

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
        console.log(`[SOCIAL-POST] Slot=${slot}: Published "${creative.headline}" (${creative.content_type}) via ${creative.narrator}`);
        return NextResponse.json({
          status: 'published',
          slot,
          type: creative.content_type,
          postId: result.postId,
          headline: creative.headline,
          narrator: creative.narrator,
          city: creative.city,
          scheduledFor: creative.scheduled_for,
        });
      }

      // Failed to publish — try next creative
      console.error(`[SOCIAL-POST] Instagram publish failed for "${creative.headline}": ${result.error}`);
    }

    // All creatives failed
    return NextResponse.json({
      status: 'error',
      error: `All ${approvedCreatives.length} approved creatives failed to publish`,
    }, { status: 500 });

  } catch (error) {
    console.error('[SOCIAL-POST] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

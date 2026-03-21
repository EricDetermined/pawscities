import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { publishImagePost } from '@/lib/instagram';
import {
  CONTENT_BANK,
  CITY_META,
  generateCaption,
  pickNextContent,
  getEstablishmentPhotoUrl,
} from '@/lib/social-content';

// Vercel cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Map city keys to JSON filenames
const CITY_FILE_MAP: Record<string, string> = {
  paris: 'paris-places',
  geneva: 'geneva-places',
  london: 'london-places',
  barcelona: 'barcelona-places',
  losangeles: 'los-angeles-places',
  nyc: 'nyc-places',
  sydney: 'sydney-places',
  tokyo: 'tokyo-places',
};

interface PlaceData {
  name: string;
  photoRefs?: string[];
  category?: string;
  [key: string]: unknown;
}

/**
 * Create a Supabase admin client (service role) for cron jobs
 * Falls back gracefully if not configured
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey);
}

/**
 * GET /api/cron/social-post
 *
 * Called by Vercel Cron (or manually by admin) to auto-post to Instagram.
 * Flow:
 * 1. Read posting history from Supabase (or fallback to JSON file)
 * 2. Pick the next content using round-robin city rotation
 * 3. Find a Google Places photo from a featured establishment in that city
 * 4. Publish to Instagram via the Meta Graph API
 * 5. Log the post to Supabase
 *
 * Auth: requires CRON_SECRET header or query param
 */
export async function GET(request: NextRequest) {
  // Authenticate
  const authHeader = request.headers.get('authorization');
  const cronParam = request.nextUrl.searchParams.get('secret');
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && cronParam !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Load posting history from Supabase
    const supabase = getSupabaseAdmin();
    let postedHeadlines = new Set<string>();
    let totalPosted = 0;

    if (supabase) {
      const { data: posts } = await supabase
        .from('social_posts')
        .select('headline')
        .eq('status', 'published');

      if (posts) {
        postedHeadlines = new Set(posts.map((p: { headline: string }) => p.headline));
        totalPosted = posts.length;
      }
    } else {
      // Fallback: read from JSON (works in dev)
      try {
        const historyPath = path.join(process.cwd(), 'social-post-history.json');
        const raw = await fs.readFile(historyPath, 'utf-8');
        const history = JSON.parse(raw);
        postedHeadlines = new Set(history.map((h: { headline: string }) => h.headline));
        totalPosted = history.length;
      } catch {
        // No history yet
      }
    }

    // 2. Pick next content
    const fact = pickNextContent(postedHeadlines);
    if (!fact) {
      return NextResponse.json({
        status: 'exhausted',
        message: 'All 44 content pieces have been posted. Time to create new content!',
        totalPosted,
      });
    }

    const cityMeta = CITY_META[fact.city];
    const caption = generateCaption(fact);

    // 3. Find a photo from a featured establishment in this city
    const cityFile = CITY_FILE_MAP[fact.city];
    let imageUrl = '';

    if (cityFile) {
      try {
        const dataPath = path.join(process.cwd(), 'research-output', `${cityFile}.json`);
        const cityData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
        const places: PlaceData[] = cityData.places || [];

        // Find places with photos - try multiple in case some have expired tokens
        const placesWithPhotos = places.filter(p => p.photoRefs && p.photoRefs.length > 0);
        if (placesWithPhotos.length > 0) {
          // Try up to 5 different places to find a working photo
          for (let attempt = 0; attempt < Math.min(5, placesWithPhotos.length); attempt++) {
            const idx = (totalPosted + attempt) % placesWithPhotos.length;
            const place = placesWithPhotos[idx];
            const photoRef = place.photoRefs![0];
            const candidateUrl = getEstablishmentPhotoUrl(photoRef);

            // Verify the photo URL actually works before using it
            try {
              const testResponse = await fetch(candidateUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                imageUrl = candidateUrl;
                console.log(`Using photo from "${place.name}" (attempt ${attempt + 1})`);
                break;
              } else {
                console.log(`Photo expired for "${place.name}" (${testResponse.status}), trying next...`);
              }
            } catch {
              console.log(`Photo fetch failed for "${place.name}", trying next...`);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to load city data for ${fact.city}:`, err);
      }
    }

    if (!imageUrl) {
      // Log the failure so we can track it
      if (supabase) {
        await supabase.from('social_posts').insert({
          platform: 'instagram',
          headline: fact.headline,
          city: fact.city,
          caption,
          status: 'failed',
          error_message: `No working photo found for ${fact.city}. All photo tokens may be expired.`,
        });
      }
      return NextResponse.json({
        status: 'error',
        error: `No working photo available for ${fact.city}. Photo tokens may be expired — the weekly refresh job will fix this.`,
      }, { status: 500 });
    }

    // 4. Dry run mode - return what would be posted without publishing
    if (dryRun) {
      return NextResponse.json({
        status: 'dry_run',
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

    // 5. Publish to Instagram
    const result = await publishImagePost(imageUrl, caption);

    // 6. Log to Supabase (or fallback to console)
    if (supabase) {
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
    } else {
      console.log('Social post result:', {
        headline: fact.headline,
        city: fact.city,
        success: result.success,
        postId: result.postId,
        error: result.error,
      });
    }

    if (!result.success) {
      return NextResponse.json({
        status: 'error',
        error: result.error,
        fact: { city: fact.city, headline: fact.headline },
        imageUrl,
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'published',
      postId: result.postId,
      fact: {
        city: fact.city,
        cityName: cityMeta?.name,
        headline: fact.headline,
      },
      totalPosted: totalPosted + 1,
      remainingContent: CONTENT_BANK.length - postedHeadlines.size - 1,
    });
  } catch (error) {
    console.error('Social post cron error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

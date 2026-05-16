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

// Read at request time, not build time
function getCronSecret() { return process.env.CRON_SECRET; }

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
  neighborhood?: string;
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

// ─── Smart Photo Matching ──────────────────────────────────────────────────────
// Analyze post content to determine what kind of venue photo would be relevant

type ContentType = 'did-you-know' | 'tip' | 'spotlight' | 'event' | 'guide' | 'fun';

/**
 * Infer preferred establishment categories from post content.
 * Returns an array of normalized category keywords to match against.
 */
function inferPhotoCategory(headline: string, body: string, type: ContentType): string[] {
  const text = `${headline} ${body}`.toLowerCase();

  // Outdoor / nature signals
  if (/beach|swim|lake|ocean|surf|sand|waterfront|shore|coastal/.test(text)) {
    return ['park', 'beach', 'outdoor'];
  }
  if (/park|garden|trail|hike|walk|green|forest|woods|off-leash|run free/.test(text)) {
    return ['park', 'beach', 'outdoor'];
  }

  // Café / brunch signals
  if (/caf[eé]|coffee|brunch|latte|espresso|bakery|pastry|croissant/.test(text)) {
    return ['cafe', 'cafes', 'brunch'];
  }

  // Restaurant / dining signals
  if (/restaurant|dining|dinner|roast|menu|chef|food|eat|meal|bistro|brasserie/.test(text)) {
    return ['restaurant', 'restaurants', 'pub', 'pubs', 'dining'];
  }

  // Hotel / accommodation signals
  if (/hotel|stay|accommodation|resort|boutique hotel|check.?in|room|suite/.test(text)) {
    return ['hotel', 'hotels'];
  }

  // Shopping signals
  if (/shop|store|boutique|market|retail|buy|pet store/.test(text)) {
    return ['shop', 'shopping', 'pet shop'];
  }

  // Pub / bar signals
  if (/pub|bar|beer|brew|wine|cocktail|pint|tap room|happy hour/.test(text)) {
    return ['pub', 'pubs', 'restaurant', 'restaurants'];
  }

  // Transit / general city signals — use cafés as they're the most photogenic
  if (/metro|tube|train|transit|bus|ride|transport/.test(text)) {
    return ['cafe', 'cafes', 'restaurant', 'restaurants'];
  }

  // Event type posts — prefer outdoor/park venues
  if (type === 'event') {
    return ['park', 'beach', 'outdoor', 'cafe'];
  }

  // Default: cafés and restaurants are the most visually appealing fallback
  return ['cafe', 'cafes', 'restaurant', 'restaurants'];
}

/**
 * Check if an establishment category matches any of the preferred categories.
 * Handles the inconsistent category naming across different city data files.
 */
function matchesCategory(estCategory: string, preferred: string[]): boolean {
  const cat = estCategory.toLowerCase().replace(/[\/\s]+/g, ' ');

  for (const pref of preferred) {
    const p = pref.toLowerCase();
    // Direct match
    if (cat === p || cat === p + 's') return true;
    // Partial match (e.g. "Cafe/Brunch" contains "cafe", "Dog Beach/Park" contains "park")
    if (cat.includes(p)) return true;
    // Handle plurals both ways
    if (p.endsWith('s') && cat === p.slice(0, -1)) return true;
  }
  return false;
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

  const cronSecret = getCronSecret();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && cronParam !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Load posting history from Supabase
    const supabase = getSupabaseAdmin();
    let postedHeadlines = new Set<string>();
    let totalPosted = 0;

    if (supabase) {
      // Get published posts
      const { data: posts } = await supabase
        .from('social_posts')
        .select('headline')
        .eq('status', 'published');

      if (posts) {
        postedHeadlines = new Set(posts.map((p: { headline: string }) => p.headline));
        totalPosted = posts.length;
      }

      // Also skip headlines that have failed 3+ times to prevent infinite retry loops
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

    // 3. Find the image — prefer stored branded creative, fall back to Google photo
    const cityFile = CITY_FILE_MAP[fact.city];
    let imageUrl = '';

    // First, check for a pre-generated branded creative in Supabase Storage
    const factIndex = CONTENT_BANK.indexOf(fact);
    if (supabase && factIndex >= 0) {
      try {
        // List files with prefix matching since creatives have timestamps in filenames
        // e.g. "barcelona-13-1774147605581.png" instead of "barcelona-13.png"
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
            // Verify the creative exists
            const testRes = await fetch(urlData.publicUrl, { method: 'HEAD' });
            if (testRes.ok) {
              imageUrl = urlData.publicUrl;
              console.log(`Using stored branded creative "${files[0].name}" for "${fact.headline}"`);
            }
          }
        }
      } catch {
        // Fall through to Google photo fallback
      }
    }

    // Fallback: find a MATCHING Google photo from a relevant establishment
    // Smart matching: analyze post content to pick a photo that fits the theme

    if (!imageUrl && cityFile) {
      try {
        const dataPath = path.join(process.cwd(), 'research-output', `${cityFile}.json`);
        const cityData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
        const places: PlaceData[] = cityData.places || [];

        // Determine what kind of venue photo matches this content
        const preferredCategories = inferPhotoCategory(fact.headline, fact.body, fact.type);
        console.log(`[PHOTO-MATCH] "${fact.headline}" → preferred: [${preferredCategories.join(', ')}]`);

        // Find places with photos, prioritizing category matches
        const placesWithPhotos = places.filter(p => p.photoRefs && p.photoRefs.length > 0);

        // Sort: matching categories first, then others as fallback
        const sorted = [...placesWithPhotos].sort((a, b) => {
          const aMatch = matchesCategory(a.category || '', preferredCategories) ? 0 : 1;
          const bMatch = matchesCategory(b.category || '', preferredCategories) ? 0 : 1;
          return aMatch - bMatch;
        });

        const matchedCount = sorted.filter(p => matchesCategory(p.category || '', preferredCategories)).length;
        console.log(`[PHOTO-MATCH] ${matchedCount}/${sorted.length} places match preferred categories`);

        if (sorted.length > 0) {
          // Rotate within matched places (or all if no matches)
          const pool = matchedCount > 0 ? sorted.slice(0, matchedCount) : sorted;
          for (let attempt = 0; attempt < Math.min(5, pool.length); attempt++) {
            const idx = (totalPosted + attempt) % pool.length;
            const place = pool[idx];
            const photoRef = place.photoRefs![0];
            const candidateUrl = getEstablishmentPhotoUrl(photoRef);

            // Verify the photo URL actually works before using it
            try {
              const testResponse = await fetch(candidateUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                imageUrl = candidateUrl;
                console.log(`[PHOTO-MATCH] Using "${place.name}" (${place.category}) for "${fact.headline}"`);
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

    // 3b. If imageUrl is a proxy URL (not Supabase), download and re-upload to Supabase Storage
    // Instagram Graph API needs a direct, publicly accessible image URL
    if (supabase && imageUrl.includes('/api/places/photo')) {
      try {
        console.log('Downloading proxy image for Supabase upload...');
        const imgResponse = await fetch(imageUrl);
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
          const ext = contentType.includes('png') ? 'png' : 'jpg';
          const storagePath = `instagram-posts/${fact.city}-${Date.now()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(storagePath, imgBuffer, {
              contentType,
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('photos')
              .getPublicUrl(storagePath);

            if (publicUrlData?.publicUrl) {
              // Verify the uploaded image is accessible
              const verifyRes = await fetch(publicUrlData.publicUrl, { method: 'HEAD' });
              if (verifyRes.ok) {
                imageUrl = publicUrlData.publicUrl;
                console.log(`Uploaded to Supabase Storage: ${storagePath}`);
              }
            }
          } else {
            console.error('Supabase upload error:', uploadError);
          }
        }
      } catch (uploadErr) {
        console.error('Image re-upload failed, proceeding with proxy URL:', uploadErr);
      }
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

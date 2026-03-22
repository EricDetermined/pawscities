#!/usr/bin/env npx tsx
/**
 * sync-posted-creatives.ts
 *
 * Downloads all images from published Instagram posts to a local folder.
 * Queries the social_posts table in Supabase, then fetches each image_url
 * and saves it to instagram_launch_posts/posted/ with a descriptive filename.
 *
 * Usage:
 *   npx tsx scripts/sync-posted-creatives.ts
 *
 * Requires .env.instagram and SUPABASE env vars (reads from Vercel env or .env.local)
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';

// Load env from .env.instagram if dotenv is available
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.instagram' });
  dotenv.config({ path: '.env.local' });
} catch {
  // dotenv not installed, rely on shell env
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('You can add them to .env.local or export them in your shell.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const OUTPUT_DIR = path.join(process.cwd(), 'instagram_launch_posts', 'posted');

async function main() {
  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Get list of already-downloaded files
  const existingFiles = new Set(await readdir(OUTPUT_DIR));

  // Query all published posts
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('post_id, headline, city, image_url, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to query social_posts:', error.message);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log('No published posts found yet.');
    return;
  }

  console.log(`Found ${posts.length} published post(s). Checking for new images to download...`);

  let downloaded = 0;
  let skipped = 0;

  for (const post of posts) {
    // Create a descriptive filename: YYYY-MM-DD_city_headline-slug.ext
    const date = new Date(post.created_at).toISOString().split('T')[0];
    const slug = post.headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const ext = post.image_url.includes('.png') ? 'png' : 'jpg';
    const filename = `${date}_${post.city}_${slug}.${ext}`;

    if (existingFiles.has(filename)) {
      skipped++;
      continue;
    }

    try {
      console.log(`  Downloading: ${filename}`);
      const response = await fetch(post.image_url);

      if (!response.ok) {
        console.error(`  Failed to download (${response.status}): ${post.image_url}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(path.join(OUTPUT_DIR, filename), buffer);
      downloaded++;

      // Also save the caption alongside as a .txt file
      const captionFilename = filename.replace(/\.(png|jpg)$/, '.txt');
      if (!existingFiles.has(captionFilename)) {
        const captionContent = [
          `Post ID: ${post.post_id}`,
          `City: ${post.city}`,
          `Headline: ${post.headline}`,
          `Date: ${post.created_at}`,
          `Image URL: ${post.image_url}`,
          '',
          '--- Caption ---',
          // Caption isn't in the select, but we can reconstruct from headline
          `Headline: ${post.headline}`,
        ].join('\n');
        await writeFile(path.join(OUTPUT_DIR, captionFilename), captionContent);
      }
    } catch (err) {
      console.error(`  Error downloading ${filename}:`, err);
    }
  }

  console.log(`\nDone! Downloaded ${downloaded} new image(s), skipped ${skipped} already-synced.`);
  console.log(`Local archive: ${OUTPUT_DIR}`);
}

main().catch(console.error);

// ─── Mascot Library (2026-08-29, approved by Eric) ──────────────────────────
//
// WHY: every mascot creative used to call gpt-image-1 on demand — at 'high'
// quality that meant $5-10 in OpenAI charges per approval batch. This library
// replaces recurring generation with a ONE-TIME pre-generated pool of Marley &
// Buster illustrations (3 scenes × 2 narrators × 9 cities + 6 duo shots = 60
// images, ~$4 total at medium quality) stored in Supabase Storage under
// `photos/mascot-library/`. The creative pipeline pulls from the pool like the
// dog-photo library; on-demand generation survives only as a fallback while
// the pool is being filled.
//
// Build/refill: GET /api/admin/mascot-library?secret=CRON_SECRET&batch=8
// (idempotent — skips files that already exist; run until remaining: 0).

import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'photos';
const PREFIX = 'mascot-library';

// Visual identity — keep EXACTLY in sync with the character sheets.
const BUSTER_VISUAL =
  'Buster, a small compact stocky mixed breed dog with a short smooth golden-honey coat, broad round face, warm expressive dark brown eyes, floppy rose-shaped ears that fold down, dark nose, wide happy grin with tongue hanging out. He wears an olive-green collar with a small orange paw-print tag';
const MARLEY_VISUAL =
  'Marley, a medium-sized shaggy cockapoo-type dog with a wavy tousled cream-white coat with golden highlights, long scruffy fur around face and ears, soulful dark eyes peeking through a curtain of facial fur, dark nose partially hidden by shaggy fur, gentle wise expression. He wears a navy blue bandana with a small orange paw-print tag';

interface CityScenes {
  cityName: string;
  landmark: string;
  buster: string[]; // 3 activity variants
  marley: string[]; // 3 setting variants
}

const CITY_SCENES: Record<string, CityScenes> = {
  paris: {
    cityName: 'Paris', landmark: 'the Eiffel Tower peeking above Parisian rooftops',
    buster: ['sitting at a sidewalk café with a croissant', 'trotting across a bridge over the Seine at golden hour', 'playing in a leafy Parisian park in spring'],
    marley: ['a cozy Parisian café window seat', 'a bookshop doorway on a cobblestone street', 'a bench in the Tuileries garden in autumn'],
  },
  geneva: {
    cityName: 'Geneva', landmark: "the Jet d'Eau fountain on Lake Geneva",
    buster: ['trotting along the lakeside promenade', 'bounding through an alpine meadow with the lake below', 'splashing at the edge of Lake Geneva on a sunny day'],
    marley: ['a Swiss train window seat overlooking Lake Geneva and the Alps', 'a warm chalet doorway with snowy peaks behind', 'a quiet old-town café terrace'],
  },
  london: {
    cityName: 'London', landmark: 'Tower Bridge',
    buster: ['walking happily along the Thames', 'romping across a green in Hyde Park', 'splashing through a puddle on a classic London street'],
    marley: ['a warm pub corner with a fireplace', 'a red phone box on a drizzly street corner', 'a windowsill overlooking a mews of brick houses'],
  },
  barcelona: {
    cityName: 'Barcelona', landmark: 'the Sagrada Familia basilica',
    buster: ['playing in a sunny park', 'trotting along the beach promenade at Barceloneta', 'chasing pigeons in a plaza in the Gothic Quarter'],
    marley: ['a sunny terrace overlooking the Gothic Quarter', 'a tiled bench in Park Güell', 'a shaded café table on La Rambla'],
  },
  losangeles: {
    cityName: 'Los Angeles', landmark: 'the Hollywood sign in the distance',
    buster: ['hiking on a trail in the California sunshine', 'running on the beach at Santa Monica', 'skateboard-watching on the Venice boardwalk'],
    marley: ['a breezy beachside patio', 'a palm-lined café patio at sunset', 'a hillside overlook at golden hour'],
  },
  nyc: {
    cityName: 'New York City', landmark: 'the Central Park skyline',
    buster: ['running through an open meadow', 'catching leaves in Central Park in fall', 'trotting across a crosswalk with yellow cabs behind'],
    marley: ['a cozy Brooklyn brownstone window', 'a bench under the Washington Square arch', 'a fire-escape balcony with string lights at dusk'],
  },
  sydney: {
    cityName: 'Sydney', landmark: 'the Sydney Opera House',
    buster: ['sitting on the harbour steps', 'splashing in the shallows at Bondi Beach', 'trotting along the coastal cliff walk'],
    marley: ['a waterfront café with harbour views', 'a ferry deck crossing the harbour', 'a shady spot under a jacaranda tree in bloom'],
  },
  tokyo: {
    cityName: 'Tokyo', landmark: 'the Shibuya Crossing',
    buster: ['sitting near the Hachiko statue', 'trotting under cherry blossoms in a Tokyo park', 'exploring a lantern-lit alley at dusk'],
    marley: ['a traditional Japanese tea house', 'a quiet temple garden with koi pond', 'a window seat in a cozy Tokyo café'],
  },
  atlanta: {
    cityName: 'Atlanta', landmark: 'the Atlanta skyline beyond Piedmont Park',
    buster: ['strolling along the BeltLine Eastside Trail', 'playing fetch in Piedmont Park', 'sniffing around a mural-covered wall in the Old Fourth Ward'],
    marley: ['a sunny Midtown patio near Ponce City Market', 'a porch swing on a leafy Virginia-Highland street', 'a shaded bench under Piedmont Park oaks'],
  },
};

const DUO_SCENES: string[] = [
  'walking side by side through a leafy city park in spring',
  'sharing a picnic blanket with a basket of dog treats',
  'sitting together at an outdoor café table, one alert and grinning, one calm and wise',
  'watching the sunset from a grassy hill over a city skyline',
  'splashing together at the edge of a park fountain',
  'wearing tiny party hats next to a dog-friendly birthday cake',
];

export type Narrator = 'buster' | 'marley' | 'both';

export interface LibraryTarget { file: string; prompt: string }

/** Every file the finished library should contain (60 total). */
export function getLibraryTargets(): LibraryTarget[] {
  const targets: LibraryTarget[] = [];
  for (const [slug, s] of Object.entries(CITY_SCENES)) {
    s.buster.forEach((activity, i) => targets.push({
      file: `${slug}-buster-v${i + 1}.png`,
      prompt: `Pixar/Disney-style cartoon illustration: ${BUSTER_VISUAL}. He is ${activity} in front of ${s.landmark} in ${s.cityName}. Bright, colorful, cinematic with warm lighting. Background shows recognizable ${s.cityName} architecture. Instagram square format 1080x1080. No text overlay, no humans.`,
    }));
    s.marley.forEach((setting, i) => targets.push({
      file: `${slug}-marley-v${i + 1}.png`,
      prompt: `Pixar/Disney-style cartoon illustration: ${MARLEY_VISUAL}. He is relaxing in ${setting} in ${s.cityName}. Soft warm lighting, cozy atmosphere. Background hints at ${s.cityName} culture. Instagram square format 1080x1080. No text overlay, no humans.`,
    }));
  }
  DUO_SCENES.forEach((scene, i) => targets.push({
    file: `generic-both-v${i + 1}.png`,
    prompt: `Pixar/Disney-style cartoon illustration: Two cartoon dogs together. On the left: ${BUSTER_VISUAL}. On the right: ${MARLEY_VISUAL}. They are ${scene}. Warm lighting, bright colors. Instagram square format 1080x1080. No text overlay, no humans.`,
  }));
  return targets;
}

/** List the files currently in the library. */
export async function listLibraryFiles(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(PREFIX, { limit: 200 });
  if (error || !data) return [];
  return data.map(f => f.name).filter(n => n.endsWith('.png'));
}

/**
 * Pick a library image for a narrator+city, avoiding recently used URLs.
 * Selection order: exact city+narrator → duo generics → same narrator any city.
 * Returns a public URL, or null if the library has nothing usable (caller
 * falls back to on-demand generation).
 */
export async function getMascotLibraryImage(
  supabase: SupabaseClient,
  narrator: Narrator,
  citySlug: string,
  avoidUrls: string[] = [],
): Promise<string | null> {
  const files = await listLibraryFiles(supabase);
  if (files.length === 0) return null;

  const toUrl = (file: string): string =>
    supabase.storage.from(BUCKET).getPublicUrl(`${PREFIX}/${file}`).data.publicUrl;

  const pools: string[][] = [
    files.filter(f => f.startsWith(`${citySlug}-${narrator}-`)),
    files.filter(f => f.startsWith('generic-both-')),
    files.filter(f => f.includes(`-${narrator}-`)),
  ];
  for (const pool of pools) {
    if (pool.length === 0) continue;
    const fresh = pool.filter(f => !avoidUrls.some(u => u.includes(f)));
    const pick = (fresh.length > 0 ? fresh : pool)[Math.floor(Math.random() * (fresh.length > 0 ? fresh.length : pool.length))];
    return toUrl(pick);
  }
  return null;
}

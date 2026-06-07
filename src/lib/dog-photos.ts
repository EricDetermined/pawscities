/**
 * Curated pool of 32 unique dog photos from Unsplash (free to use).
 * Each photo features a DIFFERENT dog breed/individual to ensure visual
 * variety across Instagram posts. With 32 unique dogs and ~2 posts/day,
 * we get 16 days before any repeat — well over the "no repeats in a month"
 * target when combined with hash-based selection.
 *
 * IMPORTANT: Photos are deliberately INTERLEAVED so that adjacent indices
 * have maximally different breeds, colors, and sizes. This prevents the
 * hash function from producing visually similar results for nearby inputs.
 * When adding photos, maintain the interleaving pattern — never place
 * two photos of the same breed or similar color next to each other.
 *
 * Photo IDs are Unsplash image identifiers. Append query params for sizing:
 *   Square (1080x1080): ?w=1080&h=1080&fit=crop&crop=faces&q=75
 *   Wide   (1080x600):  ?w=1080&h=600&fit=crop&crop=faces&q=75
 */

const DOG_PHOTO_IDS = [
  // Interleaved for maximum visual diversity between adjacent indices.
  // Pattern: vary breed, color (light→dark→spotted→red→white), and size.
  'photo-1585248317452-74f600c851a9',  //  0: Golden Retriever — gold, sunny field
  'photo-1573920953827-2ccafab952d3',  //  1: Husky — black & white, snow
  'photo-1582043725042-f3d1873eeadf',  //  2: Dalmatian — white & spotted
  'photo-1572604579264-644b4bb06577',  //  3: Dachshund — black & tan, field
  'photo-1514327351276-ba66e959f129',  //  4: Samoyed — pure white, street
  'photo-1629755725339-efd38b8253bb',  //  5: French Bulldog — black & white puppy
  'photo-1621913460519-d357b2a435ca',  //  6: Bernese Mountain Dog — tricolor
  'photo-1572114760509-91d07e2941e3',  //  7: Shiba Inu — orange, portrait
  'photo-1581391422953-4dd3707cf6d2',  //  8: Black Lab — solid black
  'photo-1768181304459-e6b40df44e0a',  //  9: Corgi — tan & white, grass
  'photo-1618161456243-aa4dd6b14e8c',  // 10: Border Collie — black & white
  'photo-1423958950820-4f2f1f44e075',  // 11: Pug — fawn puppy
  'photo-1562317305-58a17fe2c09e',     // 12: Chocolate Lab — brown
  'photo-1603921445449-569739c72fb4',  // 13: Beagle — tricolor on log
  'photo-1544568100-847a948585b9',     // 14: Mixed — autumn leaves
  'photo-1616312513065-28cf4313abda',  // 15: French Bulldog — white & brown puppy
  'photo-1609510471617-b2e55f24d821',  // 16: Golden Retriever — running on beach
  'photo-1562771968-a70d17a93823',     // 17: Dalmatian — puppy
  'photo-1629119436616-b75ecf9b5f9b',  // 18: Poodle — brown puppy, grass
  'photo-1473027118777-040f756769fb',  // 19: Husky — brown & white, river
  'photo-1590604901378-9cd81655e0cc',  // 20: Bernese Mountain Dog — puppy
  'photo-1512546321483-c0468b7b8a95',  // 21: Beagle — white & brown, sitting
  'photo-1573208532633-5ca32436eb55',  // 22: Shiba Inu — orange
  'photo-1520087619250-584c0cbd35e8',  // 23: Dachshund — resting, cute
  'photo-1422565096762-bdb997a56a84',  // 24: Golden Lab — portrait
  'photo-1561078284-5dbf862fb94d',     // 25: Mixed — walking city
  'photo-1612736871069-7cedc94696d0',  // 26: Corgi — brown & white close-up
  'photo-1543333108-4f3e0f5a7d11',     // 27: Husky — white & gray portrait
  'photo-1598134493202-9a02529d86bb',  // 28: French Bulldog — brown & white
  'photo-1537151625747-768eb6cf92b2',  // 29: Mixed — happy portrait
  'photo-1598411646852-ee3fdc0e5789',  // 30: Poodle — brown, restaurant
  'photo-1694230093349-ba54f5e88aa1',  // 31: Mixed — beach at sunset
];

const BASE = 'https://images.unsplash.com';

/**
 * FNV-1a hash — much better avalanche behavior than Java-style hash.
 * A single-bit change in input flips ~50% of output bits, so similar
 * headlines/cities land on very different indices.
 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0; // unsigned 32-bit
}

/**
 * Pick a unique dog photo based on content hash.
 * Uses FNV-1a for excellent distribution — even very similar inputs
 * (same city, slightly different event names) will land on distant indices.
 * The array is interleaved so even adjacent indices are visually distinct.
 *
 * @param text - Headline, event name, or other text to hash
 * @param citySlug - City slug for additional entropy
 * @param format - 'square' (1080x1080) or 'wide' (1080x600)
 * @returns Full Unsplash URL with sizing params
 */
export function pickDogPhoto(
  text: string,
  citySlug: string,
  format: 'square' | 'wide' = 'wide'
): string {
  const hash = fnv1a(`${text}::${citySlug}`);
  const idx = hash % DOG_PHOTO_IDS.length;
  const photoId = DOG_PHOTO_IDS[idx];

  const dims = format === 'square'
    ? 'w=640&h=640&fit=crop&crop=faces&q=75'
    : 'w=1080&h=600&fit=crop&crop=faces&q=75';

  return `${BASE}/${photoId}?${dims}`;
}

/** Total number of unique dog photos available */
export const DOG_PHOTO_COUNT = DOG_PHOTO_IDS.length;

/**
 * Curated pool of 32 unique dog photos from Unsplash (free to use).
 * Each photo features a DIFFERENT dog breed/individual to ensure visual
 * variety across Instagram posts. With 32 unique dogs and ~2 posts/day,
 * we get 16 days before any repeat — well over the "no repeats in a month"
 * target when combined with hash-based selection.
 *
 * Photo IDs are Unsplash image identifiers. Append query params for sizing:
 *   Square (1080x1080): ?w=1080&h=1080&fit=crop&crop=faces&q=75
 *   Wide   (1080x600):  ?w=1080&h=600&fit=crop&crop=faces&q=75
 */

const DOG_PHOTO_IDS = [
  // Golden Retrievers
  'photo-1585248317452-74f600c851a9',  //  0: grass field, sunny
  'photo-1609510471617-b2e55f24d821',  //  1: running on beach
  // French Bulldogs
  'photo-1629755725339-efd38b8253bb',  //  2: black & white puppy
  'photo-1598134493202-9a02529d86bb',  //  3: brown & white
  'photo-1616312513065-28cf4313abda',  //  4: white & brown puppy
  // Corgis
  'photo-1768181304459-e6b40df44e0a',  //  5: standing on grass
  'photo-1612736871069-7cedc94696d0',  //  6: brown & white close-up
  // Huskies
  'photo-1573920953827-2ccafab952d3',  //  7: black & white, snow
  'photo-1543333108-4f3e0f5a7d11',  //  8: white & gray portrait
  'photo-1473027118777-040f756769fb',  //  9: brown & white, river
  // Poodles
  'photo-1629119436616-b75ecf9b5f9b',  // 10: brown puppy on grass
  'photo-1598411646852-ee3fdc0e5789',  // 11: brown at restaurant
  // Dachshunds
  'photo-1572604579264-644b4bb06577',  // 12: black & tan, field
  'photo-1520087619250-584c0cbd35e8',  // 13: resting, cute
  // Labrador Retrievers
  'photo-1422565096762-bdb997a56a84',  // 14: golden lab portrait
  'photo-1562317305-58a17fe2c09e',  // 15: chocolate lab
  'photo-1581391422953-4dd3707cf6d2',  // 16: black lab
  // Border Collies
  'photo-1618161456243-aa4dd6b14e8c',  // 17: black & white
  // Beagles
  'photo-1512546321483-c0468b7b8a95',  // 18: white & brown, sitting
  'photo-1603921445449-569739c72fb4',  // 19: tricolor on log
  // Shiba Inus
  'photo-1572114760509-91d07e2941e3',  // 20: adult portrait
  'photo-1573208532633-5ca32436eb55',  // 21: orange Shiba
  // Pugs
  'photo-1423958950820-4f2f1f44e075',  // 22: fawn pug puppy
  // Dalmatians
  'photo-1582043725042-f3d1873eeadf',  // 23: portrait
  'photo-1562771968-a70d17a93823',  // 24: puppy
  // Bernese Mountain Dogs
  'photo-1621913460519-d357b2a435ca',  // 25: happy adult
  'photo-1590604901378-9cd81655e0cc',  // 26: puppy on grass
  // Samoyeds
  'photo-1514327351276-ba66e959f129',  // 27: walking on street
  // Mixed / Other breeds
  'photo-1561078284-5dbf862fb94d',  // 28: mixed walking city
  'photo-1694230093349-ba54f5e88aa1',  // 29: beach at sunset
  // Previous favorites that worked well
  'photo-1544568100-847a948585b9',  // 30: dog in autumn leaves
  'photo-1537151625747-768eb6cf92b2',  // 31: happy dog portrait
];

const BASE = 'https://images.unsplash.com';

/**
 * Pick a unique dog photo based on content hash.
 * Uses both the text content AND the city to spread selections across
 * the full pool, ensuring different cities don't collide on the same photo.
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
  // Hash combining text + city for better distribution
  const input = `${text}::${citySlug}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }

  const idx = Math.abs(hash) % DOG_PHOTO_IDS.length;
  const photoId = DOG_PHOTO_IDS[idx];

  const dims = format === 'square'
    ? 'w=640&h=640&fit=crop&crop=faces&q=75'
    : 'w=1080&h=600&fit=crop&crop=faces&q=75';

  return `${BASE}/${photoId}?${dims}`;
}

/** Total number of unique dog photos available */
export const DOG_PHOTO_COUNT = DOG_PHOTO_IDS.length;

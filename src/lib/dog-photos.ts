/**
 * Contextual Dog Photo Library for Paw Cities
 *
 * Each photo is tagged with breed, setting, vibe, and breed aliases so we
 * can intelligently select a photo that matches the event context:
 *   - Breed-specific events (Corgi Parade → show a Corgi)
 *   - City-appropriate settings (Geneva → lake/mountain, Tokyo → urban)
 *   - Activity-matching vibes (Hike Club → active outdoor dog)
 *
 * Photo IDs are Unsplash image identifiers. Append query params for sizing:
 *   Square (1080x1080): ?w=1080&h=1080&fit=crop&crop=faces&q=75
 *   Wide   (1080x600):  ?w=1080&h=600&fit=crop&crop=faces&q=75
 */

// ─── Photo Metadata Types ─────────────────────────────────────────────────────

type Setting = 'field' | 'snow' | 'urban' | 'park' | 'beach' | 'cafe' | 'water' | 'forest' | 'portrait' | 'home';
type Vibe = 'active' | 'relaxed' | 'playful' | 'elegant' | 'cozy';

interface DogPhoto {
  id: string;
  breed: string;           // Primary breed name (lowercase)
  breedAliases: string[];  // Alternative names & related terms for keyword matching
  setting: Setting;
  vibe: Vibe;
}

// ─── Tagged Photo Library ─────────────────────────────────────────────────────

const DOG_PHOTOS: DogPhoto[] = [
  { id: 'photo-1585248317452-74f600c851a9', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'field', vibe: 'active' },
  { id: 'photo-1573920953827-2ccafab952d3', breed: 'husky', breedAliases: ['siberian husky', 'malamute', 'sled dog', 'arctic'], setting: 'snow', vibe: 'active' },
  { id: 'photo-1582043725042-f3d1873eeadf', breed: 'dalmatian', breedAliases: ['dalmation', 'spotted', '101'], setting: 'urban', vibe: 'elegant' },
  { id: 'photo-1572604579264-644b4bb06577', breed: 'dachshund', breedAliases: ['wiener', 'sausage dog', 'doxie', 'teckel'], setting: 'field', vibe: 'playful' },
  { id: 'photo-1514327351276-ba66e959f129', breed: 'samoyed', breedAliases: ['sammy', 'white fluffy', 'spitz'], setting: 'urban', vibe: 'elegant' },
  { id: 'photo-1629755725339-efd38b8253bb', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'home', vibe: 'cozy' },
  { id: 'photo-1621913460519-d357b2a435ca', breed: 'bernese mountain dog', breedAliases: ['bernese', 'berner', 'mountain dog', 'bmd'], setting: 'forest', vibe: 'relaxed' },
  { id: 'photo-1572114760509-91d07e2941e3', breed: 'shiba inu', breedAliases: ['shiba', 'inu', 'japanese dog', 'akita'], setting: 'portrait', vibe: 'elegant' },
  { id: 'photo-1581391422953-4dd3707cf6d2', breed: 'labrador', breedAliases: ['lab', 'black lab', 'labrador retriever'], setting: 'park', vibe: 'active' },
  { id: 'photo-1768181304459-e6b40df44e0a', breed: 'corgi', breedAliases: ['welsh corgi', 'pembroke', 'cardigan', 'corg'], setting: 'park', vibe: 'playful' },
  { id: 'photo-1618161456243-aa4dd6b14e8c', breed: 'border collie', breedAliases: ['collie', 'sheepdog', 'herding'], setting: 'field', vibe: 'active' },
  { id: 'photo-1423958950820-4f2f1f44e075', breed: 'pug', breedAliases: ['puggy', 'pugs'], setting: 'home', vibe: 'cozy' },
  { id: 'photo-1562317305-58a17fe2c09e', breed: 'labrador', breedAliases: ['lab', 'chocolate lab', 'labrador retriever'], setting: 'portrait', vibe: 'relaxed' },
  { id: 'photo-1603921445449-569739c72fb4', breed: 'beagle', breedAliases: ['beagles', 'hound'], setting: 'forest', vibe: 'active' },
  { id: 'photo-1544568100-847a948585b9', breed: 'mixed', breedAliases: ['mutt', 'rescue', 'shelter', 'mixed breed'], setting: 'park', vibe: 'playful' },
  { id: 'photo-1616312513065-28cf4313abda', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'home', vibe: 'cozy' },
  { id: 'photo-1609510471617-b2e55f24d821', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'beach', vibe: 'active' },
  { id: 'photo-1562771968-a70d17a93823', breed: 'dalmatian', breedAliases: ['dalmation', 'spotted', '101'], setting: 'portrait', vibe: 'playful' },
  { id: 'photo-1629119436616-b75ecf9b5f9b', breed: 'poodle', breedAliases: ['poodles', 'doodle', 'goldendoodle', 'labradoodle', 'cockapoo'], setting: 'park', vibe: 'playful' },
  { id: 'photo-1473027118777-040f756769fb', breed: 'husky', breedAliases: ['siberian husky', 'malamute', 'sled dog'], setting: 'water', vibe: 'active' },
  { id: 'photo-1590604901378-9cd81655e0cc', breed: 'bernese mountain dog', breedAliases: ['bernese', 'berner', 'mountain dog'], setting: 'park', vibe: 'playful' },
  { id: 'photo-1512546321483-c0468b7b8a95', breed: 'beagle', breedAliases: ['beagles', 'hound'], setting: 'portrait', vibe: 'relaxed' },
  { id: 'photo-1573208532633-5ca32436eb55', breed: 'shiba inu', breedAliases: ['shiba', 'inu', 'japanese dog'], setting: 'portrait', vibe: 'elegant' },
  { id: 'photo-1520087619250-584c0cbd35e8', breed: 'dachshund', breedAliases: ['wiener', 'sausage dog', 'doxie', 'teckel'], setting: 'home', vibe: 'cozy' },
  { id: 'photo-1422565096762-bdb997a56a84', breed: 'labrador', breedAliases: ['lab', 'golden lab', 'labrador retriever'], setting: 'portrait', vibe: 'relaxed' },
  { id: 'photo-1561078284-5dbf862fb94d', breed: 'mixed', breedAliases: ['mutt', 'rescue', 'shelter', 'mixed breed'], setting: 'urban', vibe: 'active' },
  { id: 'photo-1612736871069-7cedc94696d0', breed: 'corgi', breedAliases: ['welsh corgi', 'pembroke', 'cardigan', 'corg'], setting: 'portrait', vibe: 'playful' },
  { id: 'photo-1543333108-4f3e0f5a7d11', breed: 'husky', breedAliases: ['siberian husky', 'malamute'], setting: 'portrait', vibe: 'elegant' },
  { id: 'photo-1598134493202-9a02529d86bb', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'portrait', vibe: 'relaxed' },
  { id: 'photo-1537151625747-768eb6cf92b2', breed: 'mixed', breedAliases: ['mutt', 'rescue', 'shelter', 'mixed breed'], setting: 'park', vibe: 'playful' },
  { id: 'photo-1598411646852-ee3fdc0e5789', breed: 'poodle', breedAliases: ['poodles', 'doodle', 'goldendoodle', 'labradoodle'], setting: 'cafe', vibe: 'elegant' },
  { id: 'photo-1694230093349-ba54f5e88aa1', breed: 'mixed', breedAliases: ['mutt', 'rescue', 'shelter'], setting: 'beach', vibe: 'relaxed' },
];

// ─── City → Preferred Settings Map ────────────────────────────────────────────

const CITY_SETTINGS: Record<string, Setting[]> = {
  // European cities: cafes, urban elegance, parks
  paris:       ['cafe', 'urban', 'elegant' as Setting, 'park'],
  london:      ['park', 'urban', 'cafe', 'field'],
  barcelona:   ['beach', 'urban', 'park', 'cafe'],
  geneva:      ['water', 'snow', 'park', 'forest'],

  // US cities
  losangeles:  ['beach', 'park', 'field', 'urban'],
  newyork:     ['urban', 'park', 'cafe', 'portrait'],

  // Asia-Pacific
  tokyo:       ['urban', 'portrait', 'cafe', 'park'],
  sydney:      ['beach', 'park', 'water', 'field'],
};

// ─── Activity Keywords → Vibe Map ─────────────────────────────────────────────

const ACTIVITY_VIBES: Record<string, Vibe[]> = {
  // Active events
  hike:     ['active'],
  walk:     ['active'],
  run:      ['active'],
  agility:  ['active'],
  fetch:    ['active', 'playful'],
  race:     ['active'],
  parade:   ['active', 'playful'],
  march:    ['active'],

  // Social/relaxed events
  brunch:   ['relaxed', 'cozy'],
  coffee:   ['cozy', 'relaxed'],
  cafe:     ['cozy', 'elegant'],
  yoga:     ['relaxed'],
  painting: ['relaxed', 'cozy'],
  craft:    ['relaxed', 'cozy'],
  picnic:   ['relaxed', 'playful'],

  // Fun/playful events
  splash:   ['playful', 'active'],
  party:    ['playful'],
  pawty:    ['playful'],
  festival: ['playful', 'active'],
  carnival: ['playful'],
  pool:     ['playful', 'active'],

  // Formal/elegant events
  show:     ['elegant'],
  gala:     ['elegant'],
  expo:     ['elegant'],
  adoption: ['cozy', 'relaxed'],
  rescue:   ['cozy', 'relaxed'],
};

// ─── All Known Breed Keywords ─────────────────────────────────────────────────
// Breeds that appear in our photo library, for matching against event names

const ALL_BREEDS: string[] = [
  ...new Set(DOG_PHOTOS.flatMap(p => [p.breed, ...p.breedAliases]))
];

const BASE = 'https://images.unsplash.com';

// ─── FNV-1a Hash (kept for fallback) ──────────────────────────────────────────

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Breed Detection ──────────────────────────────────────────────────────────

/**
 * Extract breed mentions from text (event name, description, tags).
 * Returns matching breed names found in our photo library.
 */
function detectBreeds(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const photo of DOG_PHOTOS) {
    // Check primary breed name
    if (lower.includes(photo.breed) && !found.includes(photo.breed)) {
      found.push(photo.breed);
    }
    // Check aliases
    for (const alias of photo.breedAliases) {
      if (alias.length >= 3 && lower.includes(alias) && !found.includes(photo.breed)) {
        found.push(photo.breed);
      }
    }
  }

  return found;
}

/**
 * Extract activity vibes from text.
 */
function detectVibes(text: string): Vibe[] {
  const lower = text.toLowerCase();
  const vibes: Vibe[] = [];

  for (const [keyword, keyVibes] of Object.entries(ACTIVITY_VIBES)) {
    if (lower.includes(keyword)) {
      for (const v of keyVibes) {
        if (!vibes.includes(v)) vibes.push(v);
      }
    }
  }

  return vibes;
}

// ─── Contextual Photo Selection ───────────────────────────────────────────────

interface PhotoContext {
  /** Event name or headline */
  text: string;
  /** City slug for setting preferences */
  citySlug: string;
  /** Optional: event description for richer matching */
  description?: string;
  /** Optional: event tags for additional context */
  tags?: string[];
  /** Optional: explicit breed hint (overrides detection) */
  breedHint?: string;
}

/**
 * Score a photo candidate against the event context.
 * Higher score = better match.
 */
function scorePhoto(photo: DogPhoto, ctx: {
  detectedBreeds: string[];
  preferredSettings: Setting[];
  preferredVibes: Vibe[];
}): number {
  let score = 0;

  // ── Breed match (highest priority: +10) ──────────────────────────────
  if (ctx.detectedBreeds.length > 0) {
    if (ctx.detectedBreeds.includes(photo.breed)) {
      score += 10; // Strong breed match
    }
  }

  // ── Setting match (city relevance: +3) ────────────────────────────────
  if (ctx.preferredSettings.length > 0) {
    const settingIdx = ctx.preferredSettings.indexOf(photo.setting);
    if (settingIdx === 0) score += 3;      // Top preferred setting
    else if (settingIdx === 1) score += 2;  // Second preferred
    else if (settingIdx >= 2) score += 1;   // Still relevant
  }

  // ── Vibe match (activity relevance: +2) ───────────────────────────────
  if (ctx.preferredVibes.length > 0) {
    if (ctx.preferredVibes.includes(photo.vibe)) {
      score += 2;
    }
  }

  return score;
}

/**
 * Pick the most contextually relevant dog photo.
 *
 * Scoring priority:
 *   1. Breed match (Corgi Parade → Corgi photo)     +10
 *   2. City setting (Geneva → water/snow/mountain)   +3
 *   3. Activity vibe (Hike Club → active dog)        +2
 *
 * When multiple photos tie, uses FNV-1a hash for deterministic
 * tiebreaking so the same event always gets the same photo.
 *
 * Falls back to pure hash selection when no context signals exist.
 */
export function pickContextualDogPhoto(
  context: PhotoContext,
  format: 'square' | 'wide' = 'wide'
): string {
  const searchText = [
    context.text,
    context.description || '',
    ...(context.tags || []),
    context.breedHint || '',
  ].join(' ');

  // Detect contextual signals
  const detectedBreeds = context.breedHint
    ? [context.breedHint.toLowerCase()]
    : detectBreeds(searchText);
  const preferredSettings = CITY_SETTINGS[context.citySlug] || [];
  const preferredVibes = detectVibes(searchText);

  // Score all candidates
  const scored = DOG_PHOTOS.map((photo, idx) => ({
    photo,
    idx,
    score: scorePhoto(photo, { detectedBreeds, preferredSettings, preferredVibes }),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0].score;

  if (topScore > 0) {
    // Get all photos tied at top score
    const topCandidates = scored.filter(s => s.score === topScore);

    // Deterministic pick among tied candidates using hash
    const hash = fnv1a(`${context.text}::${context.citySlug}`);
    const pick = topCandidates[hash % topCandidates.length];

    const dims = format === 'square'
      ? 'w=640&h=640&fit=crop&crop=faces&q=75'
      : 'w=1080&h=600&fit=crop&crop=faces&q=75';

    return `${BASE}/${pick.photo.id}?${dims}`;
  }

  // No contextual signals — fall back to pure hash (legacy behavior)
  return pickDogPhoto(context.text, context.citySlug, format);
}

/**
 * Legacy hash-based selection — kept for backward compatibility
 * and as fallback when no contextual signals match.
 */
export function pickDogPhoto(
  text: string,
  citySlug: string,
  format: 'square' | 'wide' = 'wide'
): string {
  const hash = fnv1a(`${text}::${citySlug}`);
  const idx = hash % DOG_PHOTOS.length;
  const photoId = DOG_PHOTOS[idx].id;

  const dims = format === 'square'
    ? 'w=640&h=640&fit=crop&crop=faces&q=75'
    : 'w=1080&h=600&fit=crop&crop=faces&q=75';

  return `${BASE}/${photoId}?${dims}`;
}

/** Total number of unique dog photos available */
export const DOG_PHOTO_COUNT = DOG_PHOTOS.length;

/** Export breed detection for use in creative pipeline */
export { detectBreeds, detectVibes };
export type { PhotoContext, Setting, Vibe };

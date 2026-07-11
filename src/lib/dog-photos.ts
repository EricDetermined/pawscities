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

type Setting = 'field' | 'snow' | 'urban' | 'park' | 'beach' | 'cafe' | 'water' | 'forest' | 'portrait' | 'home' | 'trail';
type Vibe = 'active' | 'relaxed' | 'playful' | 'elegant' | 'cozy' | 'curious';

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
  { id: 'photo-1587300003388-59208cc962cb', breed: 'cavalier king charles spaniel', breedAliases: ['cavalier', 'king charles', 'spaniel', 'ckcs'], setting: 'park', vibe: 'relaxed' },
  { id: 'photo-1558788353-f76d92f33ddc', breed: 'australian shepherd', breedAliases: ['aussie', 'australian', 'aussie shepherd'], setting: 'field', vibe: 'active' },
  { id: 'photo-1530281700549-e82e7bf110d6', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'water', vibe: 'playful' },
  { id: 'photo-1548199973-03cce0bbc87b', breed: 'german shepherd', breedAliases: ['german', 'shepherd', 'gsd', 'alsatian'], setting: 'forest', vibe: 'active' },
  { id: 'photo-1477884213360-7e9d7dcc8f9b', breed: 'puppy mixed', breedAliases: ['puppy', 'pup', 'mixed breed', 'mutt'], setting: 'home', vibe: 'cozy' },
  { id: 'photo-1587559073078-6d2c1ac9beae', breed: 'pomeranian', breedAliases: ['pom', 'spitz', 'pomeranian'], setting: 'portrait', vibe: 'elegant' },
  { id: 'photo-1583337130417-13219ce08bcd', breed: 'yorkshire terrier', breedAliases: ['yorkie', 'yorkshire', 'terrier'], setting: 'home', vibe: 'cozy' },
  { id: 'photo-1568572933382-74d440642117', breed: 'pitbull', breedAliases: ['pit bull', 'pittie', 'bully', 'american pitbull'], setting: 'urban', vibe: 'active' },
  { id: 'photo-1588022274642-f238f77ec193', breed: 'jack russell', breedAliases: ['jack russell terrier', 'jrt', 'russell terrier'], setting: 'beach', vibe: 'playful' },
  { id: 'photo-1583511655826-05700d52f4d9', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'snow', vibe: 'active' },
  { id: 'photo-1601758228041-f3b2795255f1', breed: 'maltese', breedAliases: ['maltese', 'maltipoo', 'white lap dog'], setting: 'cafe', vibe: 'elegant' },
  { id: 'photo-1596492784531-6e6eb5ea9993', breed: 'border collie', breedAliases: ['collie', 'sheepdog', 'herding'], setting: 'field', vibe: 'active' },
  { id: 'photo-1576201836106-db1758fd1c97', breed: 'maltipoo', breedAliases: ['maltipoo', 'malti-poo', 'poodle mix', 'doodle'], setting: 'park', vibe: 'playful' },
  { id: 'photo-1535930749574-1399327ce78f', breed: 'labrador', breedAliases: ['lab', 'labrador retriever', 'yellow lab'], setting: 'beach', vibe: 'active' },
  { id: 'photo-1546421845-6471bdcf3edf', breed: 'corgi', breedAliases: ['welsh corgi', 'pembroke', 'cardigan', 'corg'], setting: 'urban', vibe: 'playful' },
  { id: 'photo-1588943211346-0908a1fb0b01', breed: 'husky', breedAliases: ['siberian husky', 'malamute', 'sled dog', 'arctic'], setting: 'snow', vibe: 'elegant' },
  { id: 'photo-1587764379990-bcc0c1ef9c3d', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'park', vibe: 'relaxed' },
  { id: 'photo-1560807707-8cc77767d783', breed: 'rottweiler', breedAliases: ['rottie', 'rottweiler', 'rott'], setting: 'forest', vibe: 'active' },
  { id: 'photo-1504595403791-c75482ef15eb', breed: 'mixed breed', breedAliases: ['mutt', 'rescue', 'shelter', 'mixed'], setting: 'beach', vibe: 'relaxed' },
  { id: 'photo-1522276498395-f4f68f7f8454', breed: 'shiba inu', breedAliases: ['shiba', 'inu', 'japanese dog'], setting: 'urban', vibe: 'elegant' },
  { id: 'photo-1518717758536-85ae29035b6d', breed: 'german shepherd', breedAliases: ['german', 'shepherd', 'gsd', 'alsatian'], setting: 'park', vibe: 'active' },
  { id: 'photo-1586671267731-da2cf3ceeb80', breed: 'chihuahua', breedAliases: ['chi', 'chihuahua', 'chi-chi'], setting: 'home', vibe: 'cozy' },
  { id: 'photo-1583512603805-3cc6b41f3edb', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'park', vibe: 'playful' },
  { id: 'photo-1561037404-61cd46aa615b', breed: 'great dane', breedAliases: ['dane', 'great dane', 'gentle giant'], setting: 'field', vibe: 'elegant' },
  { id: 'photo-1554692918-08fa0fdc9db3', breed: 'boxer', breedAliases: ['boxer', 'boxers'], setting: 'park', vibe: 'active' },
  { id: 'photo-1552053831-71594a27632d', breed: 'labrador puppy', breedAliases: ['lab', 'puppy', 'labrador', 'lab puppy'], setting: 'home', vibe: 'playful' },
  { id: 'photo-1593134257782-e89567b7718a', breed: 'samoyed', breedAliases: ['sammy', 'white fluffy', 'spitz', 'samoyed'], setting: 'snow', vibe: 'playful' },
  { id: 'photo-1548658166-136d9f6a5c3e', breed: 'mixed breed', breedAliases: ['mutt', 'rescue', 'shelter', 'mixed'], setting: 'cafe', vibe: 'relaxed' },
  { id: 'photo-1541364983171-a8ba01e95cfc', breed: 'english bulldog', breedAliases: ['bulldog', 'english bull', 'british bulldog'], setting: 'urban', vibe: 'relaxed' },
  { id: 'photo-1596662951482-0c4ba74a6df6', breed: 'australian shepherd', breedAliases: ['aussie', 'australian', 'aussie shepherd'], setting: 'water', vibe: 'active' },
  { id: 'photo-1595435934249-5df7ed86e1c0', breed: 'bichon frise', breedAliases: ['bichon', 'frise', 'bichon frise'], setting: 'portrait', vibe: 'elegant' },
  { id: 'photo-1517423440428-a5a00ad493e8', breed: 'mixed terrier', breedAliases: ['terrier', 'mixed terrier', 'terrier mix'], setting: 'forest', vibe: 'playful' },
  { id: 'photo-1537151625747-768eb6cf92b3', breed: 'mixed breed', breedAliases: ['mutt', 'rescue', 'shelter', 'mixed'], setting: 'park', vibe: 'active' },
  { id: 'photo-1551717743-49959800-shel', breed: 'shetland sheepdog', breedAliases: ['sheltie', 'shetland', 'sheepdog', 'miniature collie'], setting: 'trail', vibe: 'curious' },
  { id: 'photo-1587402092301-725e37c70fd8', breed: 'beagle', breedAliases: ['beagles', 'hound'], setting: 'trail', vibe: 'curious' },
];

// ─── City → Preferred Settings Map ────────────────────────────────────────────

const CITY_SETTINGS: Record<string, Setting[]> = {
  // European cities: cafes, urban elegance, parks
  paris:       ['cafe', 'urban', 'elegant' as Setting, 'park'],
  london:      ['park', 'urban', 'cafe', 'field'],
  barcelona:   ['beach', 'urban', 'park', 'cafe'],
  geneva:      ['water', 'snow', 'park', 'forest', 'trail'],

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
  hike:     ['active', 'curious'],
  walk:     ['active', 'curious'],
  explore:  ['curious', 'active'],
  sniff:    ['curious', 'playful'],
  trail:    ['active', 'curious'],
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
  /** Optional: photo IDs used recently — these will be excluded to prevent repetition */
  recentlyUsedPhotoIds?: string[];
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
 * Pick a contextually relevant dog photo with recency-aware selection.
 *
 * Scoring priority:
 *   1. Breed match (Corgi Parade → Corgi photo)     +10
 *   2. City setting (Geneva → water/snow/mountain)   +3
 *   3. Activity vibe (Hike Club → active dog)        +2
 *
 * Selection improvements (v2):
 *   - Excludes recently-used photo IDs to prevent grid repetition
 *   - Uses RANDOM tiebreaking instead of deterministic hash
 *   - Falls back gracefully: if all top-scored photos were recently used,
 *     picks from second-tier scores before reusing
 *
 * Returns both the URL and the selected photo ID for tracking.
 */
export function pickContextualDogPhoto(
  context: PhotoContext,
  format: 'square' | 'wide' = 'wide'
): string {
  const result = pickContextualDogPhotoWithId(context, format);
  return result.url;
}

/**
 * Same as pickContextualDogPhoto but also returns the photo ID
 * so callers can track which photo was used for dedup.
 */
export function pickContextualDogPhotoWithId(
  context: PhotoContext,
  format: 'square' | 'wide' = 'wide'
): { url: string; photoId: string } {
  const searchText = [
    context.text,
    context.description || '',
    ...(context.tags || []),
    context.breedHint || '',
  ].join(' ');

  const recentIds = new Set(context.recentlyUsedPhotoIds || []);

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
    isRecent: recentIds.has(photo.id),
  }));

  // Sort by: not-recent first, then score descending
  scored.sort((a, b) => {
    // Penalize recently used photos (push them to the end)
    if (a.isRecent !== b.isRecent) return a.isRecent ? 1 : -1;
    return b.score - a.score;
  });

  // Take top candidates: prefer non-recent with good scores
  const topScore = scored[0].score;
  let candidates = scored.filter(s => s.score >= topScore - 1 && !s.isRecent);

  // If all good candidates were recently used, allow reuse but still prefer best scores
  if (candidates.length === 0) {
    candidates = scored.filter(s => s.score >= topScore - 1);
  }

  // If still empty (shouldn't happen), take all
  if (candidates.length === 0) {
    candidates = scored;
  }

  // RANDOM pick among candidates (not deterministic hash)
  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  const dims = format === 'square'
    ? 'w=640&h=640&fit=crop&crop=faces&q=75'
    : 'w=1080&h=600&fit=crop&crop=faces&q=75';

  return {
    url: `${BASE}/${pick.photo.id}?${dims}`,
    photoId: pick.photo.id,
  };
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

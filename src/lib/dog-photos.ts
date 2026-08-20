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
  /**
   * Mean luminance 0–1, measured from the actual image (see scripts/measure-photo-brightness.mjs).
   * Text cards lay copy over the image, so very dark photos hurt legibility and
   * read as sombre — wrong for a safety tip or a celebration alike.
   */
  brightness: number;
}

// ─── Tagged Photo Library ─────────────────────────────────────────────────────

const DOG_PHOTOS: DogPhoto[] = [
  { id: 'photo-1585248317452-74f600c851a9', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'park', vibe: 'active' , brightness: 0.449 },
  { id: 'photo-1573920953827-2ccafab952d3', breed: 'husky', breedAliases: ['siberian husky', 'malamute', 'sled dog', 'arctic'], setting: 'snow', vibe: 'active' , brightness: 0.66 },
  { id: 'photo-1582043725042-f3d1873eeadf', breed: 'dalmatian', breedAliases: ['dalmation', 'spotted', '101'], setting: 'home', vibe: 'elegant' , brightness: 0.244 },
  { id: 'photo-1572604579264-644b4bb06577', breed: 'dachshund', breedAliases: ['wiener', 'sausage dog', 'doxie', 'teckel'], setting: 'field', vibe: 'playful' , brightness: 0.537 },
  { id: 'photo-1514327351276-ba66e959f129', breed: 'samoyed', breedAliases: ['sammy', 'white fluffy', 'spitz'], setting: 'urban', vibe: 'elegant' , brightness: 0.548 },
  { id: 'photo-1629755725339-efd38b8253bb', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'portrait', vibe: 'cozy' , brightness: 0.338 },
  { id: 'photo-1621913460519-d357b2a435ca', breed: 'bernese mountain dog', breedAliases: ['bernese', 'berner', 'mountain dog', 'bmd'], setting: 'forest', vibe: 'relaxed' , brightness: 0.39 },
  { id: 'photo-1572114760509-91d07e2941e3', breed: 'shiba inu', breedAliases: ['shiba', 'inu', 'japanese dog'], setting: 'snow', vibe: 'elegant' , brightness: 0.709 },
  { id: 'photo-1581391422953-4dd3707cf6d2', breed: 'labrador', breedAliases: ['lab', 'black lab', 'labrador retriever'], setting: 'portrait', vibe: 'active' , brightness: 0.063 },
  { id: 'photo-1768181304459-e6b40df44e0a', breed: 'corgi', breedAliases: ['welsh corgi', 'pembroke', 'cardigan', 'corg'], setting: 'park', vibe: 'playful' , brightness: 0.468 },
  { id: 'photo-1618161456243-aa4dd6b14e8c', breed: 'border collie', breedAliases: ['collie', 'sheepdog', 'herding'], setting: 'field', vibe: 'active' , brightness: 0.358 },
  { id: 'photo-1423958950820-4f2f1f44e075', breed: 'pug', breedAliases: ['puggy', 'pugs'], setting: 'portrait', vibe: 'cozy' , brightness: 0.179 },
  { id: 'photo-1562317305-58a17fe2c09e', breed: 'labrador', breedAliases: ['lab', 'chocolate lab', 'labrador retriever'], setting: 'portrait', vibe: 'relaxed' , brightness: 0.549 },
  { id: 'photo-1603921445449-569739c72fb4', breed: 'basset hound', breedAliases: ['basset', 'hound'], setting: 'forest', vibe: 'active' , brightness: 0.598 },
  { id: 'photo-1544568100-847a948585b9', breed: 'nova scotia duck tolling retriever', breedAliases: ['toller', 'duck toller', 'tolling retriever'], setting: 'trail', vibe: 'playful' , brightness: 0.39 },
  { id: 'photo-1616312513065-28cf4313abda', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'home', vibe: 'cozy' , brightness: 0.429 },
  { id: 'photo-1609510471617-b2e55f24d821', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'beach', vibe: 'active' , brightness: 0.586 },
  { id: 'photo-1562771968-a70d17a93823', breed: 'dalmatian', breedAliases: ['dalmation', 'spotted', '101'], setting: 'urban', vibe: 'playful' , brightness: 0.575 },
  { id: 'photo-1629119436616-b75ecf9b5f9b', breed: 'poodle', breedAliases: ['poodles', 'doodle', 'labradoodle'], setting: 'park', vibe: 'playful' , brightness: 0.555 },
  { id: 'photo-1473027118777-040f756769fb', breed: 'husky', breedAliases: ['siberian husky', 'malamute', 'sled dog'], setting: 'water', vibe: 'active' , brightness: 0.619 },
  { id: 'photo-1590604901378-9cd81655e0cc', breed: 'bernese mountain dog', breedAliases: ['bernese', 'berner', 'mountain dog'], setting: 'park', vibe: 'playful' , brightness: 0.451 },
  { id: 'photo-1512546321483-c0468b7b8a95', breed: 'beagle', breedAliases: ['beagles', 'hound'], setting: 'urban', vibe: 'relaxed' , brightness: 0.375 },
  { id: 'photo-1573208532633-5ca32436eb55', breed: 'shiba inu', breedAliases: ['shiba', 'inu', 'japanese dog'], setting: 'urban', vibe: 'elegant' , brightness: 0.436 },
  { id: 'photo-1520087619250-584c0cbd35e8', breed: 'dachshund', breedAliases: ['wiener', 'sausage dog', 'doxie', 'teckel'], setting: 'portrait', vibe: 'cozy' , brightness: 0.837 },
  { id: 'photo-1422565096762-bdb997a56a84', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'home', vibe: 'relaxed' , brightness: 0.556 },
  { id: 'photo-1561078284-5dbf862fb94d', breed: 'mixed', breedAliases: ['mutt', 'rescue', 'shelter', 'mixed breed'], setting: 'urban', vibe: 'active' , brightness: 0.479 },
  { id: 'photo-1612736871069-7cedc94696d0', breed: 'border collie', breedAliases: ['collie', 'sheepdog', 'herding'], setting: 'portrait', vibe: 'playful' , brightness: 0.387 },
  { id: 'photo-1543333108-4f3e0f5a7d11', breed: 'alaskan malamute', breedAliases: ['malamute', 'alaskan malamute', 'sled dog'], setting: 'urban', vibe: 'elegant' , brightness: 0.635 },
  { id: 'photo-1598134493202-9a02529d86bb', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'portrait', vibe: 'relaxed' , brightness: 0.462 },
  { id: 'photo-1537151625747-768eb6cf92b2', breed: 'corgi', breedAliases: ['welsh corgi', 'pembroke', 'cardigan', 'corg'], setting: 'portrait', vibe: 'playful' , brightness: 0.508 },
  { id: 'photo-1598411646852-ee3fdc0e5789', breed: 'poodle', breedAliases: ['poodles', 'doodle', 'labradoodle'], setting: 'cafe', vibe: 'elegant' , brightness: 0.388 },
  { id: 'photo-1694230093349-ba54f5e88aa1', breed: 'mixed', breedAliases: ['mutt', 'rescue', 'shelter'], setting: 'beach', vibe: 'relaxed' , brightness: 0.613 },
  { id: 'photo-1587300003388-59208cc962cb', breed: 'cavalier king charles spaniel', breedAliases: ['cavalier', 'king charles', 'spaniel', 'ckcs'], setting: 'beach', vibe: 'relaxed' , brightness: 0.673 },
  { id: 'photo-1530281700549-e82e7bf110d6', breed: 'nova scotia duck tolling retriever', breedAliases: ['toller', 'duck toller', 'tolling retriever'], setting: 'beach', vibe: 'playful' , brightness: 0.666 },
  { id: 'photo-1548199973-03cce0bbc87b', breed: 'corgi', breedAliases: ['welsh corgi', 'pembroke', 'cardigan', 'corg'], setting: 'trail', vibe: 'active' , brightness: 0.524 },
  { id: 'photo-1568572933382-74d440642117', breed: 'husky', breedAliases: ['siberian husky', 'malamute', 'sled dog'], setting: 'home', vibe: 'active' , brightness: 0.325 },
  { id: 'photo-1588022274642-f238f77ec193', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'park', vibe: 'playful' , brightness: 0.239 },
  { id: 'photo-1583511655826-05700d52f4d9', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'portrait', vibe: 'active' , brightness: 0.667 },
  { id: 'photo-1601758228041-f3b2795255f1', breed: 'maltese', breedAliases: ['maltese', 'maltipoo', 'white lap dog'], setting: 'home', vibe: 'elegant' , brightness: 0.51 },
  { id: 'photo-1596492784531-6e6eb5ea9993', breed: 'samoyed', breedAliases: ['sammy', 'white fluffy'], setting: 'portrait', vibe: 'active' , brightness: 0.675 },
  { id: 'photo-1576201836106-db1758fd1c97', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'park', vibe: 'playful' , brightness: 0.435 },
  { id: 'photo-1535930749574-1399327ce78f', breed: 'labrador', breedAliases: ['lab', 'labrador retriever', 'yellow lab'], setting: 'home', vibe: 'active' , brightness: 0.397 },
  { id: 'photo-1546421845-6471bdcf3edf', breed: 'poodle', breedAliases: ['poodles', 'doodle', 'labradoodle'], setting: 'urban', vibe: 'playful' , brightness: 0.573 },
  { id: 'photo-1588943211346-0908a1fb0b01', breed: 'cocker spaniel', breedAliases: ['cocker', 'spaniel'], setting: 'park', vibe: 'elegant' , brightness: 0.496 },
  { id: 'photo-1560807707-8cc77767d783', breed: 'cavalier king charles spaniel', breedAliases: ['cavalier', 'king charles', 'ckcs'], setting: 'forest', vibe: 'active' , brightness: 0.63 },
  { id: 'photo-1522276498395-f4f68f7f8454', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'urban', vibe: 'elegant' , brightness: 0.427 },
  { id: 'photo-1518717758536-85ae29035b6d', breed: 'german shepherd', breedAliases: ['german', 'shepherd', 'gsd', 'alsatian'], setting: 'urban', vibe: 'active' , brightness: 0.486 },
  { id: 'photo-1586671267731-da2cf3ceeb80', breed: 'labrador', breedAliases: ['lab', 'labrador retriever'], setting: 'portrait', vibe: 'cozy' , brightness: 0.302 },
  { id: 'photo-1583512603805-3cc6b41f3edb', breed: 'french bulldog', breedAliases: ['frenchie', 'french bull', 'bulldog'], setting: 'portrait', vibe: 'playful' , brightness: 0.657 },
  { id: 'photo-1561037404-61cd46aa615b', breed: 'great dane', breedAliases: ['dane', 'great dane', 'gentle giant'], setting: 'portrait', vibe: 'elegant' , brightness: 0.707 },
  { id: 'photo-1554692918-08fa0fdc9db3', breed: 'corgi', breedAliases: ['welsh corgi', 'pembroke', 'cardigan', 'corg'], setting: 'urban', vibe: 'active' , brightness: 0.401 },
  { id: 'photo-1552053831-71594a27632d', breed: 'golden retriever', breedAliases: ['golden', 'retriever', 'goldie'], setting: 'urban', vibe: 'playful' , brightness: 0.332 },
  { id: 'photo-1593134257782-e89567b7718a', breed: 'samoyed', breedAliases: ['sammy', 'white fluffy', 'spitz', 'samoyed'], setting: 'snow', vibe: 'playful' , brightness: 0.549 },
  { id: 'photo-1541364983171-a8ba01e95cfc', breed: 'pug', breedAliases: ['puggy', 'pugs'], setting: 'portrait', vibe: 'relaxed' , brightness: 0.516 },
  { id: 'photo-1596662951482-0c4ba74a6df6', breed: 'australian shepherd', breedAliases: ['aussie', 'australian', 'aussie shepherd'], setting: 'water', vibe: 'active' , brightness: 0.25 },
  { id: 'photo-1595435934249-5df7ed86e1c0', breed: 'bichon frise', breedAliases: ['bichon', 'frise', 'bichon frise'], setting: 'portrait', vibe: 'elegant' , brightness: 0.539 },
  { id: 'photo-1517423440428-a5a00ad493e8', breed: 'pug', breedAliases: ['puggy', 'pugs'], setting: 'portrait', vibe: 'playful' , brightness: 0.16 },
  { id: 'photo-1587402092301-725e37c70fd8', breed: 'samoyed', breedAliases: ['sammy', 'white fluffy'], setting: 'park', vibe: 'curious' , brightness: 0.786 },

  // ── Breed-gap coverage ───────────────────────────────────────────────
  // Generated 2026-08-19 to cover breeds named in events/content that the
  // Unsplash set did not stock. Each was vision-verified as the correct breed,
  // single dog, no people or text, before being admitted. Stored in Supabase,
  // so these ids are full URLs rather than Unsplash slugs.
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/miniature-schnauzer-1787158421126.png', breed: 'miniature schnauzer', breedAliases: ['schnauzer', 'mini schnauzer', 'miniature schnauzer', 'giant schnauzer'], setting: 'park', vibe: 'active', brightness: 0.517 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/pomeranian-1787158474902.png', breed: 'pomeranian', breedAliases: ['pom', 'pomeranian', 'pom pom'], setting: 'urban', vibe: 'playful', brightness: 0.738 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/chihuahua-1787158569483.png', breed: 'chihuahua', breedAliases: ['chihuahua', 'chi hua hua'], setting: 'home', vibe: 'cozy', brightness: 0.718 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/yorkshire-terrier-1787158626652.png', breed: 'yorkshire terrier', breedAliases: ['yorkie', 'yorkshire terrier'], setting: 'cafe', vibe: 'elegant', brightness: 0.633 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/australian-kelpie-1787158678800.png', breed: 'australian kelpie', breedAliases: ['kelpie', 'australian kelpie'], setting: 'field', vibe: 'active', brightness: 0.661 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/staffordshire-bull-terrier-1787158753486.png', breed: 'staffordshire bull terrier', breedAliases: ['staffy', 'staffordshire', 'american bully', 'pit bull', 'pitbull', 'bully'], setting: 'park', vibe: 'playful', brightness: 0.517 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/shetland-sheepdog-1787158803127.png', breed: 'shetland sheepdog', breedAliases: ['sheltie', 'shetland sheepdog', 'miniature collie'], setting: 'trail', vibe: 'curious', brightness: 0.43 },

  // ── Full breed coverage (generated 2026-08-19) ───────────────────────
  // Event-common breeds worldwide plus city-signature breeds for the nine
  // markets. Each vision-verified for correct breed, single dog, no people or
  // text before admission; brightness measured from the real pixels.
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/rottweiler-1787165843897.png', breed: 'rottweiler', breedAliases: ['rottie', 'rott'], setting: 'park', vibe: 'relaxed', brightness: 0.499 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/jack-russell-terrier-1787165844590.png', breed: 'jack russell terrier', breedAliases: ['jack russell', 'jrt', 'parson russell'], setting: 'beach', vibe: 'playful', brightness: 0.819 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/boston-terrier-1787165847136.png', breed: 'boston terrier', breedAliases: ['boston', 'boston terriers'], setting: 'home', vibe: 'playful', brightness: 0.704 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/english-bulldog-1787165847875.png', breed: 'english bulldog', breedAliases: ['british bulldog', 'english bull'], setting: 'urban', vibe: 'relaxed', brightness: 0.492 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/doberman-1787165849277.png', breed: 'doberman', breedAliases: ['dobermann', 'dobie', 'doberman pinscher'], setting: 'park', vibe: 'elegant', brightness: 0.516 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/boxer-1787165853652.png', breed: 'boxer', breedAliases: ['boxers'], setting: 'field', vibe: 'active', brightness: 0.532 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/greyhound-1787165904189.png', breed: 'greyhound', breedAliases: ['greyhounds', 'racing greyhound'], setting: 'park', vibe: 'relaxed', brightness: 0.572 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/vizsla-1787165904660.png', breed: 'vizsla', breedAliases: ['hungarian vizsla'], setting: 'field', vibe: 'active', brightness: 0.628 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/akita-1787165904552.png', breed: 'akita', breedAliases: ['akita inu', 'japanese akita'], setting: 'urban', vibe: 'elegant', brightness: 0.405 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/italian-greyhound-1787165907324.png', breed: 'italian greyhound', breedAliases: ['iggy', 'italian greyhounds'], setting: 'cafe', vibe: 'elegant', brightness: 0.46 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/weimaraner-1787165910751.png', breed: 'weimaraner', breedAliases: ['weim', 'weimaraners'], setting: 'forest', vibe: 'curious', brightness: 0.554 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/whippet-1787165950591.png', breed: 'whippet', breedAliases: ['whippets'], setting: 'field', vibe: 'active', brightness: 0.595 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/english-springer-spaniel-1787165957045.png', breed: 'english springer spaniel', breedAliases: ['springer spaniel', 'springer'], setting: 'trail', vibe: 'active', brightness: 0.456 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/german-shorthaired-pointer-1787165957175.png', breed: 'german shorthaired pointer', breedAliases: ['gsp', 'shorthaired pointer', 'pointer'], setting: 'field', vibe: 'active', brightness: 0.666 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/chow-chow-1787166017246.png', breed: 'chow chow', breedAliases: ['chow', 'chowchow'], setting: 'park', vibe: 'elegant', brightness: 0.476 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/belgian-malinois-1787166020377.png', breed: 'belgian malinois', breedAliases: ['malinois', 'mal'], setting: 'field', vibe: 'active', brightness: 0.721 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/shih-tzu-1787166020457.png', breed: 'shih tzu', breedAliases: ['shihtzu', 'shih-tzu'], setting: 'home', vibe: 'cozy', brightness: 0.616 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/papillon-1787166020617.png', breed: 'papillon', breedAliases: ['papillons', 'butterfly dog'], setting: 'park', vibe: 'playful', brightness: 0.558 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/shar-pei-1787166021118.png', breed: 'shar pei', breedAliases: ['sharpei', 'chinese shar pei'], setting: 'urban', vibe: 'curious', brightness: 0.662 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/havanese-1787166028715.png', breed: 'havanese', breedAliases: ['havanese dog'], setting: 'cafe', vibe: 'playful', brightness: 0.597 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/airedale-terrier-1787166068121.png', breed: 'airedale terrier', breedAliases: ['airedale'], setting: 'field', vibe: 'curious', brightness: 0.494 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/bull-terrier-1787166068659.png', breed: 'bull terrier', breedAliases: ['english bull terrier', 'bully terrier'], setting: 'park', vibe: 'playful', brightness: 0.495 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/rhodesian-ridgeback-1787166070996.png', breed: 'rhodesian ridgeback', breedAliases: ['ridgeback'], setting: 'trail', vibe: 'active', brightness: 0.591 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/west-highland-white-terrier-1787166073157.png', breed: 'west highland white terrier', breedAliases: ['westie', 'west highland'], setting: 'park', vibe: 'playful', brightness: 0.61 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/scottish-terrier-1787166073912.png', breed: 'scottish terrier', breedAliases: ['scottie', 'scottish terriers'], setting: 'urban', vibe: 'elegant', brightness: 0.665 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/cairn-terrier-1787166081329.png', breed: 'cairn terrier', breedAliases: ['cairn'], setting: 'trail', vibe: 'curious', brightness: 0.58 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/soft-coated-wheaten-terrier-1787166118079.png', breed: 'soft coated wheaten terrier', breedAliases: ['wheaten terrier', 'wheaten'], setting: 'park', vibe: 'playful', brightness: 0.483 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/irish-wolfhound-1787166123216.png', breed: 'irish wolfhound', breedAliases: ['wolfhound'], setting: 'field', vibe: 'relaxed', brightness: 0.577 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/portuguese-water-dog-1787166123589.png', breed: 'portuguese water dog', breedAliases: ['portie', 'portuguese water'], setting: 'water', vibe: 'active', brightness: 0.7 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/saint-bernard-1787166126045.png', breed: 'saint bernard', breedAliases: ['st bernard', 'saint bernards'], setting: 'snow', vibe: 'relaxed', brightness: 0.76 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/newfoundland-1787166126815.png', breed: 'newfoundland', breedAliases: ['newfie', 'newfoundland dog'], setting: 'water', vibe: 'relaxed', brightness: 0.512 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/great-pyrenees-1787166136225.png', breed: 'great pyrenees', breedAliases: ['pyrenean mountain dog', 'pyrenees'], setting: 'snow', vibe: 'elegant', brightness: 0.729 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/leonberger-1787166192992.png', breed: 'leonberger', breedAliases: ['leo', 'leonbergers'], setting: 'forest', vibe: 'relaxed', brightness: 0.521 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/miniature-pinscher-1787166194565.png', breed: 'miniature pinscher', breedAliases: ['min pin', 'minpin'], setting: 'home', vibe: 'playful', brightness: 0.746 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/rough-collie-1787166197184.png', breed: 'rough collie', breedAliases: ['lassie collie', 'long haired collie'], setting: 'field', vibe: 'elegant', brightness: 0.574 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/old-english-sheepdog-1787166197863.png', breed: 'old english sheepdog', breedAliases: ['oes', 'dulux dog'], setting: 'park', vibe: 'playful', brightness: 0.54 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/keeshond-1787166197941.png', breed: 'keeshond', breedAliases: ['keeshonden', 'dutch barge dog'], setting: 'park', vibe: 'playful', brightness: 0.626 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/cane-corso-1787166200464.png', breed: 'cane corso', breedAliases: ['italian mastiff', 'corso'], setting: 'urban', vibe: 'elegant', brightness: 0.664 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/bullmastiff-1787166241290.png', breed: 'bullmastiff', breedAliases: ['bull mastiff', 'mastiff'], setting: 'park', vibe: 'relaxed', brightness: 0.529 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/ibizan-hound-1787166251095.png', breed: 'ibizan hound', breedAliases: ['podenco', 'podenco ibicenco'], setting: 'beach', vibe: 'active', brightness: 0.682 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/spanish-water-dog-1787166251402.png', breed: 'spanish water dog', breedAliases: ['perro de agua', 'spanish water'], setting: 'beach', vibe: 'active', brightness: 0.595 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/cockapoo-1787166253452.png', breed: 'cockapoo', breedAliases: ['cockerpoo', 'cocker poodle'], setting: 'cafe', vibe: 'cozy', brightness: 0.595 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/beauceron-1787166304846.png', breed: 'beauceron', breedAliases: ['berger de beauce', 'bas rouge'], setting: 'field', vibe: 'active', brightness: 0.565 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/briard-1787166308078.png', breed: 'briard', breedAliases: ['berger de brie', 'briards'], setting: 'park', vibe: 'curious', brightness: 0.597 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/galgo-espanol-1787166387492.png', breed: 'galgo espanol', breedAliases: ['galgo', 'spanish greyhound'], setting: 'field', vibe: 'relaxed', brightness: 0.648 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/goldendoodle-1787166387596.png', breed: 'goldendoodle', breedAliases: ['groodle', 'golden doodle'], setting: 'park', vibe: 'playful', brightness: 0.53 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/appenzeller-sennenhund-1787166388917.png', breed: 'appenzeller sennenhund', breedAliases: ['appenzeller', 'appenzell cattle dog'], setting: 'trail', vibe: 'active', brightness: 0.491 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/catalan-sheepdog-1787166391821.png', breed: 'catalan sheepdog', breedAliases: ['gos d atura', 'gos datura', 'catalan shepherd'], setting: 'field', vibe: 'active', brightness: 0.583 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/greater-swiss-mountain-dog-1787166394672.png', breed: 'greater swiss mountain dog', breedAliases: ['swissy', 'greater swiss'], setting: 'trail', vibe: 'active', brightness: 0.495 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/barbet-1787166397584.png', breed: 'barbet', breedAliases: ['french water dog', 'barbets'], setting: 'water', vibe: 'playful', brightness: 0.626 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/australian-terrier-1787166437556.png', breed: 'australian terrier', breedAliases: ['aussie terrier'], setting: 'park', vibe: 'curious', brightness: 0.555 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/japanese-spitz-1787166439102.png', breed: 'japanese spitz', breedAliases: ['nihon supittsu'], setting: 'urban', vibe: 'playful', brightness: 0.54 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/irish-setter-1787166440253.png', breed: 'irish setter', breedAliases: ['red setter', 'setter'], setting: 'field', vibe: 'active', brightness: 0.492 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/australian-cattle-dog-1787166440886.png', breed: 'australian cattle dog', breedAliases: ['blue heeler', 'red heeler', 'cattle dog'], setting: 'field', vibe: 'active', brightness: 0.549 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/border-terrier-1787166443880.png', breed: 'border terrier', breedAliases: ['border terriers'], setting: 'trail', vibe: 'curious', brightness: 0.607 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/bloodhound-1787166450772.png', breed: 'bloodhound', breedAliases: ['bloodhounds', 'sleuth hound'], setting: 'trail', vibe: 'curious', brightness: 0.537 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/saluki-1787166545976.png', breed: 'saluki', breedAliases: ['salukis', 'persian greyhound'], setting: 'field', vibe: 'elegant', brightness: 0.762 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/english-setter-1787166546194.png', breed: 'english setter', breedAliases: ['setter', 'llewellin setter'], setting: 'field', vibe: 'active', brightness: 0.614 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/lhasa-apso-1787166552635.png', breed: 'lhasa apso', breedAliases: ['lhasa'], setting: 'home', vibe: 'cozy', brightness: 0.679 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/pekingese-1787166552657.png', breed: 'pekingese', breedAliases: ['peke', 'pekinese'], setting: 'home', vibe: 'elegant', brightness: 0.653 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/borzoi-1787166552631.png', breed: 'borzoi', breedAliases: ['russian wolfhound'], setting: 'field', vibe: 'elegant', brightness: 0.624 },
  { id: 'https://tnqctocershbclhbjnwg.supabase.co/storage/v1/object/public/photos/breed-library/basenji-1787166555297.png', breed: 'basenji', breedAliases: ['basenjis', 'barkless dog'], setting: 'urban', vibe: 'curious', brightness: 0.684 },
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
  atlanta:     ['park', 'urban', 'field', 'trail'],
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
/**
 * Breeds we can recognise in copy but have NO photo for.
 *
 * Without this list a substring/near match quietly substitutes a different
 * breed — "The Kelpie Is Australia's Own" was being illustrated with an
 * Australian Shepherd. Showing a confidently wrong dog is worse than showing a
 * generic one, so a hit here suppresses the breed override and lets the photo
 * be chosen on setting/vibe/tone instead.
 *
 * Some of these were stocked until 2026-08-19, when 9 library photo IDs were
 * found to be dead (404) and removed: pomeranian, yorkshire terrier and
 * shetland sheepdog lost their only image. Worth sourcing replacements —
 * there is a Pomeranian Fashion Show already sitting in the ingest queue.
 */
const UNSTOCKED_BREEDS: string[] = [];

/**
 * Match a term as a whole word, tolerating regular plurals/possessives.
 *
 * Plain `includes()` was matching aliases inside unrelated words: 'chi' fired
 * on "Ha-chi-ko" and "micro-chi-p", 'inu' on "cont-inu-e", 'german' on
 * "Germany's". Across the 233-fact content bank, 42 of 83 breed detections
 * were substring artefacts of this kind. A naive \b…\b fix would break the
 * legitimate plural in "The Queen's Corgis", hence the optional suffix group.
 */
function matchesWord(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}(?:s|es|'s|’s)?\\b`, 'i').test(text);
}

function detectBreeds(text: string): string[] {
  const lower = text.toLowerCase();

  // A named-but-unstocked breed means: do not guess. Return nothing so the
  // caller falls back to setting/vibe/tone matching on a neutral dog.
  if (UNSTOCKED_BREEDS.some((b) => matchesWord(lower, b))) {
    return [];
  }

  const found: string[] = [];

  for (const photo of DOG_PHOTOS) {
    if (found.includes(photo.breed)) continue;
    const terms = [photo.breed, ...photo.breedAliases];
    if (terms.some((t) => matchesWord(lower, t))) {
      found.push(photo.breed);
    }
  }

  return found;
}

/**
 * Extract activity vibes from text.
 */
/**
 * Words that are activity verbs in one reading and something else entirely in
 * another. "Check for Foxtails March Through Summer" was scored as an ACTIVE
 * post because 'march' matched the month.
 */
const AMBIGUOUS_VIBE_WORDS: Record<string, RegExp> = {
  // month name — only treat as an activity when not followed by a date-ish word
  march: /\bmarch\b(?!\s+(?:\d|through|to\b|\d{4}|and\s+april))/i,
};

function detectVibes(text: string): Vibe[] {
  const lower = text.toLowerCase();
  const vibes: Vibe[] = [];

  for (const [keyword, keyVibes] of Object.entries(ACTIVITY_VIBES)) {
    const guard = AMBIGUOUS_VIBE_WORDS[keyword];
    const hit = guard ? guard.test(lower) : matchesWord(lower, keyword);
    if (!hit) continue;
    for (const v of keyVibes) {
      if (!vibes.includes(v)) vibes.push(v);
    }
  }

  return vibes;
}

// ─── Tone Detection ───────────────────────────────────────────────────────────

/**
 * Editorial tone of the copy. The scorer previously modelled breed, setting and
 * vibe but nothing about what the post is FOR, so a foxtail-injury warning and a
 * street party drew from the same pool.
 */
export type Tone = 'warning' | 'celebration' | 'practical' | 'neutral';

const TONE_PATTERNS: Array<{ tone: Tone; re: RegExp }> = [
  { tone: 'warning', re: /\b(danger|dangerous|emergency|risk|risky|warning|toxic|poison|hazard|injur\w*|heatstroke|burn|overheat|avoid|never|beware|vet|symptom|snake|tick|foxtail)\w*/i },
  { tone: 'celebration', re: /\b(festival|parade|party|paw-?ty|celebrat\w*|birthday|anniversar\w*|winner|award|fest|gala|carnival|show)\b/i },
  { tone: 'practical', re: /\b(guide|rules?|hours?|how to|where to|book\w*|ticket|open|schedule|list|tips?|allowed|permit)\b/i },
];

export function detectTone(text: string): Tone {
  for (const { tone, re } of TONE_PATTERNS) {
    if (re.test(text)) return tone;
  }
  return 'neutral';
}

/**
 * Minimum acceptable brightness by tone. Text cards overlay copy on the photo,
 * so a near-black frame (the library's darkest sits at 0.06) is both unreadable
 * and tonally wrong. Warnings still need to look clear and daylit rather than
 * grim — a sombre image reads as grief, which is off-brand.
 */
const TONE_MIN_BRIGHTNESS: Record<Tone, number> = {
  warning: 0.40,
  celebration: 0.45,
  practical: 0.35,
  neutral: 0.30,
};

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
  /** Optional: editorial tone. Derived from the copy when omitted. */
  tone?: Tone;
}

/**
 * Score a photo candidate against the event context.
 * Higher score = better match.
 */
function scorePhoto(photo: DogPhoto, ctx: {
  detectedBreeds: string[];
  preferredSettings: Setting[];
  preferredVibes: Vibe[];
  tone?: Tone;
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

  // ── Brightness / tone fit (legibility: −4 … +1) ───────────────────────
  // Applied as a penalty rather than a filter so it can never empty the pool.
  const floor = TONE_MIN_BRIGHTNESS[ctx.tone || 'neutral'];
  if (photo.brightness < floor) {
    // Scale the penalty with how far below the floor it sits.
    score -= Math.min(4, (floor - photo.brightness) * 10);
  } else if (photo.brightness >= floor + 0.15) {
    score += 1; // comfortably legible
  }

  // A sombre frame on a celebration is the worst mismatch — punish harder.
  if (ctx.tone === 'celebration' && photo.brightness < 0.3) score -= 2;

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
  // Headline outranks body. "The Poodle: France's Icon, Germany's Invention"
  // legitimately contains both 'poodle' and 'german', but the post is about the
  // poodle — the subject is in the headline, the other breed is incidental.
  let detectedBreeds: string[];
  if (context.breedHint) {
    detectedBreeds = [context.breedHint.toLowerCase()];
  } else {
    const headlineBreeds = detectBreeds(context.text);
    detectedBreeds = headlineBreeds.length > 0 ? headlineBreeds : detectBreeds(searchText);
  }
  const preferredSettings = CITY_SETTINGS[context.citySlug] || [];
  const preferredVibes = detectVibes(searchText);
  const tone = context.tone || detectTone(searchText);

  // Score all candidates
  const scored = DOG_PHOTOS.map((photo, idx) => ({
    photo,
    idx,
    score: scorePhoto(photo, { detectedBreeds, preferredSettings, preferredVibes, tone }),
    isRecent: recentIds.has(photo.id),
  }));

  // ── BREED OVERRIDE ────────────────────────────────────────────────────
  // A breed-specific event (Corgi Fest, Frenchie Meetup…) must show that
  // breed. Recency exclusion previously outranked breed match, so a corgi
  // event could get a non-corgi photo if all corgi shots were recently
  // used. Showing the wrong dog is worse than repeating a photo — restrict
  // to breed matches whenever any exist, preferring non-recent among them.
  if (detectedBreeds.length > 0) {
    const breedMatches = scored.filter(s => detectedBreeds.includes(s.photo.breed));
    if (breedMatches.length > 0) {
      const nonRecent = breedMatches.filter(s => !s.isRecent);
      const pool = nonRecent.length > 0 ? nonRecent : breedMatches;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return {
        url: photoUrlFromId(pick.photo.id, format),
        photoId: pick.photo.id,
      };
    }
  }

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

  return {
    url: photoUrlFromId(pick.photo.id, format),
    photoId: pick.photo.id,
  };
}

/**
 * Build the sized Unsplash URL for a specific photo id.
 * Used when a caller wants to FORCE a particular (e.g. de-duplicated) photo
 * onto a creative rather than letting the picker choose randomly.
 */
export function photoUrlFromId(
  photoId: string,
  format: 'square' | 'wide' = 'wide'
): string {
  // Library entries sourced outside Unsplash (breed-gap images generated and
  // stored in Supabase) carry a full URL as their id. Those are already sized
  // and must not have Unsplash resize params appended.
  if (photoId.startsWith('http://') || photoId.startsWith('https://')) {
    return photoId;
  }
  const dims = format === 'square'
    ? 'w=640&h=640&fit=crop&crop=faces&q=75'
    : 'w=1080&h=600&fit=crop&crop=faces&q=75';
  return `${BASE}/${photoId}?${dims}`;
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
export { detectBreeds, detectVibes, DOG_PHOTOS };
export type { PhotoContext, Setting, Vibe, DogPhoto };

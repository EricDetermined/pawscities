import type { Category, CategorySlug } from '@/types';

// Use Unicode escape sequences to prevent UTF-8 encoding corruption
// when emojis pass through serialization boundaries (RSC, Leaflet divIcon HTML, etc.)
export const CATEGORIES: Record<CategorySlug, Category> = {
  restaurants: {
    slug: 'restaurants',
    name: 'Restaurants',
    nameFr: 'Restaurants',
    icon: '\u{1F37D}\uFE0F', // 🍽️
    color: '#ef4444', // red-500
  },
  cafes: {
    slug: 'cafes',
    name: 'Cafes',
    nameFr: 'Caf\u00E9s',
    icon: '\u2615', // ☕
    color: '#f97316', // orange-500
  },
  hotels: {
    slug: 'hotels',
    name: 'Hotels',
    nameFr: 'H\u00F4tels',
    icon: '\u{1F3E8}', // 🏨
    color: '#8b5cf6', // violet-500
  },
  parks: {
    slug: 'parks',
    name: 'Parks',
    nameFr: 'Parcs',
    icon: '\u{1F333}', // 🌳
    color: '#22c55e', // green-500
  },
  beaches: {
    slug: 'beaches',
    name: 'Beaches',
    nameFr: 'Plages',
    icon: '\u{1F3D6}\uFE0F', // 🏖️
    color: '#06b6d4', // cyan-500
  },
  vets: {
    slug: 'vets',
    name: 'Veterinarians',
    nameFr: 'V\u00E9t\u00E9rinaires',
    icon: '\u{1F3E5}', // 🏥
    color: '#ec4899', // pink-500
  },
  groomers: {
    slug: 'groomers',
    name: 'Groomers',
    nameFr: 'Toiletteurs',
    icon: '\u2702\uFE0F', // ✂️
    color: '#a855f7', // purple-500
  },
  shops: {
    slug: 'shops',
    name: 'Pet Shops',
    nameFr: 'Animaleries',
    icon: '\u{1F6CD}\uFE0F', // 🛍️
    color: '#f59e0b', // amber-500
  },
  activities: {
    slug: 'activities',
    name: 'Activities',
    nameFr: 'Activit\u00E9s',
    icon: '\u{1F3BE}', // 🎾
    color: '#3b82f6', // blue-500
  },
  walkers: {
    slug: 'walkers',
    name: 'Dog Walkers',
    nameFr: 'Promeneurs',
    icon: '\u{1F9AE}', // 🦮
    color: '#14b8a6', // teal-500
  },
  trainers: {
    slug: 'trainers',
    name: 'Dog Trainers',
    nameFr: '\u00C9ducateurs canins',
    icon: '\u{1F393}', // 🎓
    color: '#6366f1', // indigo-500
  },
  daycare: {
    slug: 'daycare',
    name: 'Daycare & Boarding',
    nameFr: 'Garderie & Pension',
    icon: '\u{1F3E0}', // 🏠
    color: '#d97706', // amber-600
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

// Categories that represent public spaces — these cannot be claimed by businesses
export const NON_CLAIMABLE_CATEGORIES: CategorySlug[] = ['parks', 'beaches'];

// Categories available for business claiming/listing
export const CLAIMABLE_CATEGORIES = CATEGORY_LIST.filter(
  (c) => !NON_CLAIMABLE_CATEGORIES.includes(c.slug)
);

export function isCategoryClaimable(slug: string): boolean {
  return !NON_CLAIMABLE_CATEGORIES.includes(slug as CategorySlug);
}

export function getCategoryBySlug(slug: CategorySlug): Category | undefined {
  return CATEGORIES[slug];
}

export function getCategoryIcon(slug: CategorySlug): string {
  return CATEGORIES[slug]?.icon || '📍';
}

export function getCategoryColor(slug: CategorySlug): string {
  return CATEGORIES[slug]?.color || '#6b7280';
}

export function getCategoryName(slug: CategorySlug, lang: 'en' | 'fr' = 'en'): string {
  const category = CATEGORIES[slug];
  if (!category) return slug;
  return lang === 'fr' ? category.nameFr : category.name;
}

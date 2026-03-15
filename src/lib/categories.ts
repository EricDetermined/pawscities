import type { Category, CategorySlug } from '@/types';

export const CATEGORIES: Record<CategorySlug, Category> = {
  restaurants: {
    slug: 'restaurants',
    name: 'Restaurants',
    nameFr: 'Restaurants',
    icon: 'ð½ï¸',
    color: '#ef4444', // red-500
  },
  cafes: {
    slug: 'cafes',
    name: 'Cafes',
    nameFr: 'CafÃ©s',
    icon: 'â',
    color: '#f97316', // orange-500
  },
  hotels: {
    slug: 'hotels',
    name: 'Hotels',
    nameFr: 'HÃ´tels',
    icon: 'ð¨',
    color: '#8b5cf6', // violet-500
  },
  parks: {
    slug: 'parks',
    name: 'Parks',
    nameFr: 'Parcs',
    icon: 'ð³',
    color: '#22c55e', // green-500
  },
  beaches: {
    slug: 'beaches',
    name: 'Beaches',
    nameFr: 'Plages',
    icon: 'ðï¸',
    color: '#06b6d4', // cyan-500
  },
  vets: {
    slug: 'vets',
    name: 'Veterinarians',
    nameFr: 'VÃ©tÃ©rinaires',
    icon: 'ð¥',
    color: '#ec4899', // pink-500
  },
  groomers: {
    slug: 'groomers',
    name: 'Groomers',
    nameFr: 'Toiletteurs',
    icon: 'âï¸',
    color: '#a855f7', // purple-500
  },
  shops: {
    slug: 'shops',
    name: 'Pet Shops',
    nameFr: 'Animaleries',
    icon: 'ðï¸',
    color: '#f59e0b', // amber-500
  },
  activities: {
    slug: 'activities',
    name: 'Activities',
    nameFr: 'ActivitÃ©s',
    icon: 'ð¾',
    color: '#3b82f6', // blue-500
  },
  walkers: {
    slug: 'walkers',
    name: 'Dog Walkers',
    nameFr: 'Promeneurs',
    icon: 'ð¦®',
    color: '#14b8a6', // teal-500
  },
  trainers: {
    slug: 'trainers',
    name: 'Dog Trainers',
    nameFr: 'Ãducateurs canins',
    icon: 'ð',
    color: '#6366f1', // indigo-500
  },
  daycare: {
    slug: 'daycare',
    name: 'Daycare & Boarding',
    nameFr: 'Garderie & Pension',
    icon: 'ð ',
    color: '#d97706', // amber-600
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

// Categories that represent public spaces â these cannot be claimed by businesses
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
  return CATEGORIES[slug]?.icon || 'ð';
}

export function getCategoryColor(slug: CategorySlug): string {
  return CATEGORIES[slug]?.color || '#6b7280';
}

export function getCategoryName(slug: CategorySlug, lang: 'en' | 'fr' = 'en'): string {
  const category = CATEGORIES[slug];
  if (!category) return slug;
  return lang === 'fr' ? category.nameFr : category.name;
}

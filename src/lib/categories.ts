import type { Category, CategorySlug } from '@/types';

export const CATEGORIES: Record<CategorySlug, Category> = {
  restaurants: {
    slug: 'restaurants',
    name: 'Restaurants',
    nameFr: 'Restaurants',
    icon: '🍽️',
    color: '#ef4444', // red-500
  },
  cafes: {
    slug: 'cafes',
    name: 'Cafes',
    nameFr: 'Cafés',
    icon: '☕',
    color: '#f97316', // orange-500
  },
  hotels: {
    slug: 'hotels',
    name: 'Hotels',
    nameFr: 'Hôtels',
    icon: '🏨',
    color: '#8b5cf6', // violet-500
  },
  parks: {
    slug: 'parks',
    name: 'Parks',
    nameFr: 'Parcs',
    icon: '🌳',
    color: '#22c55e', // green-500
  },
  beaches: {
    slug: 'beaches',
    name: 'Beaches',
    nameFr: 'Plages',
    icon: '🏖️',
    color: '#06b6d4', // cyan-500
  },
  vets: {
    slug: 'vets',
    name: 'Veterinarians',
    nameFr: 'Vétérinaires',
    icon: '🏥',
    color: '#ec4899', // pink-500
  },
  groomers: {
    slug: 'groomers',
    name: 'Groomers',
    nameFr: 'Toiletteurs',
    icon: '✂️',
    color: '#a855f7', // purple-500
  },
  shops: {
    slug: 'shops',
    name: 'Pet Shops',
    nameFr: 'Animaleries',
    icon: '🛍️',
    color: '#f59e0b', // amber-500
  },
  activities: {
    slug: 'activities',
    name: 'Activities',
    nameFr: 'Activités',
    icon: '🎾',
    color: '#3b82f6', // blue-500
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

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

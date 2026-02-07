import { promises as fs } from 'fs';
import path from 'path';
import { CITIES, type CityConfig } from './cities-config';
import type { Establishment, DogFeatures, CategorySlug } from '@/types';

const CITY_DATA_MAP: Record<string, string> = {
  paris: 'paris-places',
  london: 'london-places',
  losangeles: 'los-angeles-places',
  newyork: 'nyc-places',
  barcelona: 'barcelona-places',
  sydney: 'sydney-places',
  tokyo: 'tokyo-places',
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string, index: number = 0): number {
  const hash = hashString(seed + index.toString());
  return (hash % 10000) / 10000;
}

function generateCoordinates(cityConfig: CityConfig, placeName: string): { lat: number; lng: number } {
  const latOffset = (seededRandom(placeName, 0) - 0.5) * 0.06;
  const lngOffset = (seededRandom(placeName, 1) - 0.5) * 0.06;
  return { lat: cityConfig.latitude + latOffset, lng: cityConfig.longitude + lngOffset };
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CATEGORY_IMAGES: Record<string, string[]> = {
  parks: [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=300&fit=crop',
  ],
  restaurants: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&h=300&fit=crop',
  ],
  cafes: [
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
  ],
  hotels: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop',
  ],
  vets: ['https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=400&h=300&fit=crop'],
  groomers: ['https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400&h=300&fit=crop'],
  shops: ['https://images.unsplash.com/photo-1583337130417-13571c4e8ee2?w=400&h=300&fit=crop'],
  activities: ['https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=400&h=300&fit=crop'],
  beaches: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop'],
};

function getDefaultImage(category: string, name: string): string {
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES['parks'];
  return images[hashString(name) % images.length];
}

function normalizeCategory(cat: string): CategorySlug {
  const mapping: Record<string, CategorySlug> = {
    park: 'parks', parks: 'parks', restaurant: 'restaurants', restaurants: 'restaurants',
    cafe: 'cafes', cafes: 'cafes', hotel: 'hotels', hotels: 'hotels',
    beach: 'beaches', beaches: 'beaches', vet: 'vets', vets: 'vets',
    groomer: 'groomers', groomers: 'groomers', shop: 'shops', shops: 'shops',
    activity: 'activities', activities: 'activities',
  };
  return mapping[cat.toLowerCase()] || 'activities';
}

interface RawPlace {
  name: string; nameFr?: string; category: string; address: string;
  neighborhood?: string; phone?: string; website?: string;
  description: string; descriptionFr?: string;
  dogFeatures: Partial<DogFeatures>; priceLevel?: number;
  confidence?: number; reasoning?: string;
  latitude?: number; longitude?: number; rating?: number; reviewCount?: number;
}

async function loadCityJson(citySlug: string): Promise<RawPlace[]> {
  const fileName = CITY_DATA_MAP[citySlug];
  if (!fileName) return [];
  const paths = [
    path.join(process.cwd(), 'research-output', `${fileName}.json`),
    path.join(process.cwd(), `${fileName}.json`),
  ];
  for (const filePath of paths) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.places || [];
    } catch { continue; }
  }
  return [];
}

function rawToEstablishment(raw: RawPlace, citySlug: string, cityConfig: CityConfig, index: number): Establishment {
  const slug = slugify(raw.name);
  const category = normalizeCategory(raw.category);
  const coords = raw.latitude && raw.longitude
    ? { lat: raw.latitude, lng: raw.longitude }
    : generateCoordinates(cityConfig, raw.name);
  const dogFeatures: DogFeatures = {
    waterBowl: raw.dogFeatures?.waterBowl || false,
    treats: raw.dogFeatures?.treats || false,
    outdoorSeating: raw.dogFeatures?.outdoorSeating || false,
    indoorAllowed: raw.dogFeatures?.indoorAllowed || false,
    offLeashArea: raw.dogFeatures?.offLeashArea || false,
    dogMenu: raw.dogFeatures?.dogMenu || false,
    fenced: raw.dogFeatures?.fenced || false,
    shadeAvailable: raw.dogFeatures?.shadeAvailable || false,
  };
  const confidence = raw.confidence || 80;
  const baseRating = raw.rating || (3.5 + (confidence / 100) * 1.5);
  const rating = Math.round(baseRating * 10) / 10;
  return {
    id: `${citySlug}-${slug}-${index}`,
    slug, citySlug, categorySlug: category,
    name: raw.name, nameFr: raw.nameFr,
    description: raw.description, descriptionFr: raw.descriptionFr,
    address: raw.address, latitude: coords.lat, longitude: coords.lng,
    phone: raw.phone, website: raw.website,
    priceLevel: (raw.priceLevel || 2) as 1 | 2 | 3 | 4,
    rating, reviewCount: raw.reviewCount || Math.floor(seededRandom(raw.name, 3) * 80 + 5),
    images: [getDefaultImage(category, raw.name)],
    hours: {}, dogFeatures, amenities: [],
    neighborhood: raw.neighborhood,
    tier: 'free' as const,
    isVerified: confidence > 90,
    isFeatured: confidence > 95 && seededRandom(raw.name, 5) > 0.7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const dataCache = new Map<string, Establishment[]>();

export async function getCityEstablishments(citySlug: string): Promise<Establishment[]> {
  if (dataCache.has(citySlug)) return dataCache.get(citySlug)!;
  const cityConfig = CITIES[citySlug];
  if (!cityConfig) return [];
  const rawPlaces = await loadCityJson(citySlug);
  const establishments = rawPlaces.map((raw, index) => rawToEstablishment(raw, citySlug, cityConfig, index));
  dataCache.set(citySlug, establishments);
  return establishments;
}

export async function getCityEstablishmentsByCategory(citySlug: string, category: CategorySlug): Promise<Establishment[]> {
  const all = await getCityEstablishments(citySlug);
  return all.filter(e => e.categorySlug === category);
}

export async function getEstablishment(citySlug: string, establishmentSlug: string): Promise<Establishment | null> {
  const all = await getCityEstablishments(citySlug);
  return all.find(e => e.slug === establishmentSlug) || null;
}

export async function searchEstablishments(citySlug: string, query: string): Promise<Establishment[]> {
  const all = await getCityEstablishments(citySlug);
  const lower = query.toLowerCase();
  return all.filter(e =>
    e.name.toLowerCase().includes(lower) ||
    e.description.toLowerCase().includes(lower) ||
    (e.neighborhood && e.neighborhood.toLowerCase().includes(lower))
  );
}

export async function getCityCategoryCounts(citySlug: string): Promise<Record<string, number>> {
  const all = await getCityEstablishments(citySlug);
  const counts: Record<string, number> = {};
  for (const e of all) { counts[e.categorySlug] = (counts[e.categorySlug] || 0) + 1; }
  return counts;
}

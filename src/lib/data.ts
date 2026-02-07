import { promises as fs } from 'fs';
import path from 'path';
import { CITIES, type CityConfig } from './cities-config';
import type { Establishment, DogFeatures, CategorySlug } from 'A/types';

const CITY_DATA_MAP: Record<string, string> = {
  geneva: 'geneva-places',
  paris: 'paris-places',
  london: 'london-places',
  losangeles: 'los-angeles-places',
  newyork: 'nyc-places',
  barcelona: 'barcelona-places',
  sydney: 'sydney-places',
  tokyo: 'tokyo-places',
};

export async function loadCityData(city: string): Promise<Establishment[]> {
  const dataKey = CITY_DATA_MAP[city.toLowerCase()];
  if (!dataKey) {
    throw new Error(`City ${city} not found in CITY_DATA_MAP`);
  }

  const dataPath = path.join(process.cwd(), 'public', 'data', `${dataKey}.json`);
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

export const CITIES_LIST = CITIES;
export const CITY_CONFIG_MAP = CITIES.reduce((acc, city) => {
  acc[city.slug] = city;
  return acc;
}, {} as Record<string, CityConfig>);

export const getCityConfig = (slug: string): CityConfig | undefined => {
  return CITY_CONFIG_MAP[slug];
};
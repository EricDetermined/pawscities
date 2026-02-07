// City configurations for PawsCities platform

export interface CityConfig {
  slug: string;
  name: string;
  nameFr: string;
  country: string;
  countryCode: string;
  timezone: string;
  currency: string;
  latitude: number;
  longitude: number;
  zoomLevel: number;
  languages: string[];
  description: string;
  descriptionFr: string;
  heroImage: string;
  isActive: boolean;
  emergencyVetSearch: string;
  dogRegulations: {
    leashRequired: boolean;
    offLeashAreas: boolean;
    publicTransport: string;
    publicTransportFr: string;
  };
}

export const CITIES: Record<string, CityConfig> = {
  geneva: {
    slug: 'geneva', name: 'Geneva', nameFr: 'Geneve', country: 'Switzerland', countryCode: 'CH',
    timezone: 'Europe/Zurich', currency: 'CHF', latitude: 46.2044, longitude: 6.1432, zoomLevel: 13,
    languages: ['en', 'fr'],
    description: 'Discover dog-friendly parks, restaurants, hotels and more in Geneva. From Lake Geneva shores to the charming Old Town.',
    descriptionFr: 'Decouvrez les parcs, restaurants, hotels accueillant les chiens a Geneve.',
    heroImage: 'https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'emergency vet 24h geneva',
    dogRegulations: { leashRequired: true, offLeashAreas: true,
      publicTransport: 'Small dogs in carriers travel free. Larger dogs need a reduced-fare ticket.',
      publicTransportFr: 'Petits chiens en sac gratuits. Grands chiens necessitent un billet demi-tarif.' }
  },
  paris: {
    slug: 'paris', name: 'Paris', nameFr: 'Paris', country: 'France', countryCode: 'FR',
    timezone: 'Europe/Paris', currency: 'EUR', latitude: 48.8566, longitude: 2.3522, zoomLevel: 12,
    languages: ['en', 'fr'],
    description: 'Find dog-friendly cafes, parks, and boutiques across all 20 arrondissements of Paris.',
    descriptionFr: 'Trouvez les cafes, parcs et boutiques accueillant les chiens a Paris.',
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'urgence veterinaire 24h paris',
    dogRegulations: { leashRequired: true, offLeashAreas: true,
      publicTransport: 'Dogs under 6kg travel free in a carrier. Larger dogs pay half-fare and must be muzzled.',
      publicTransportFr: 'Chiens de moins de 6kg gratuits en sac. Grands chiens demi-tarif.' }
  },
  london: {
    slug: 'london', name: 'London', nameFr: 'Londres', country: 'United Kingdom', countryCode: 'GB',
    timezone: 'Europe/London', currency: 'GBP', latitude: 51.5074, longitude: -0.1278, zoomLevel: 11,
    languages: ['en', 'fr'],
    description: 'Explore dog-friendly pubs, parks, and shops across London. Hyde Park to Hampstead Heath.',
    descriptionFr: 'Explorez les pubs, parcs et boutiques accueillant les chiens a Londres.',
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'emergency vet 24h london',
    dogRegulations: { leashRequired: false, offLeashAreas: true,
      publicTransport: 'Dogs travel free on buses, Tube, Overground. Must be on a lead or in a carrier.',
      publicTransportFr: 'Chiens gratuits dans les bus, metro, Overground.' }
  },
  losangeles: {
    slug: 'losangeles', name: 'Los Angeles', nameFr: 'Los Angeles', country: 'United States', countryCode: 'US',
    timezone: 'America/Los_Angeles', currency: 'USD', latitude: 34.0522, longitude: -118.2437, zoomLevel: 10,
    languages: ['en', 'fr'],
    description: 'Discover dog-friendly beaches, hiking trails, patios, and hotels across LA.',
    descriptionFr: 'Decouvrez les plages, sentiers et terrasses accueillant les chiens a Los Angeles.',
    heroImage: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'emergency vet 24h los angeles',
    dogRegulations: { leashRequired: true, offLeashAreas: true,
      publicTransport: 'Small dogs in carriers allowed on Metro. Service animals always welcome.',
      publicTransportFr: 'Petits chiens en sac autorises dans le Metro.' }
  },
  newyork: {
    slug: 'newyork', name: 'New York City', nameFr: 'New York', country: 'United States', countryCode: 'US',
    timezone: 'America/New_York', currency: 'USD', latitude: 40.7128, longitude: -74.0060, zoomLevel: 12,
    languages: ['en', 'fr'],
    description: 'Find dog-friendly restaurants, parks, and pet services across NYC\'s five boroughs.',
    descriptionFr: 'Trouvez les restaurants, parcs et services accueillant les chiens a New York.',
    heroImage: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'emergency vet 24h new york city',
    dogRegulations: { leashRequired: true, offLeashAreas: true,
      publicTransport: 'Dogs in carriers allowed on subway, buses, and commuter rail.',
      publicTransportFr: 'Chiens en sac autorises dans le metro, bus et trains.' }
  },
  barcelona: {
    slug: 'barcelona', name: 'Barcelona', nameFr: 'Barcelone', country: 'Spain', countryCode: 'ES',
    timezone: 'Europe/Madrid', currency: 'EUR', latitude: 41.3874, longitude: 2.1686, zoomLevel: 12,
    languages: ['en', 'fr'],
    description: 'Explore dog-friendly beaches, tapas bars, and parks across Barcelona.',
    descriptionFr: 'Explorez les plages, bars a tapas et parcs accueillant les chiens a Barcelone.',
    heroImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'veterinario urgencias 24h barcelona',
    dogRegulations: { leashRequired: true, offLeashAreas: true,
      publicTransport: 'Dogs allowed on Metro and buses during off-peak hours. Must be muzzled.',
      publicTransportFr: 'Chiens autorises dans le metro et bus en heures creuses.' }
  },
  sydney: {
    slug: 'sydney', name: 'Sydney', nameFr: 'Sydney', country: 'Australia', countryCode: 'AU',
    timezone: 'Australia/Sydney', currency: 'AUD', latitude: -33.8688, longitude: 151.2093, zoomLevel: 11,
    languages: ['en', 'fr'],
    description: 'Discover dog-friendly beaches, parks, cafes, and trails across Sydney.',
    descriptionFr: 'Decouvrez les plages, parcs et cafes accueillant les chiens a Sydney.',
    heroImage: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'emergency vet 24h sydney',
    dogRegulations: { leashRequired: true, offLeashAreas: true,
      publicTransport: 'Dogs generally not allowed on public transport except assistance animals.',
      publicTransportFr: 'Chiens non autorises dans les transports sauf chiens d\'assistance.' }
  },
  tokyo: {
    slug: 'tokyo', name: 'Tokyo', nameFr: 'Tokyo', country: 'Japan', countryCode: 'JP',
    timezone: 'Asia/Tokyo', currency: 'JPY', latitude: 35.6762, longitude: 139.6503, zoomLevel: 11,
    languages: ['en', 'fr'],
    description: 'Find dog-friendly cafes, parks, shops, and grooming services across Tokyo.',
    descriptionFr: 'Trouvez les cafes, parcs et services de toilettage accueillant les chiens a Tokyo.',
    heroImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop',
    isActive: true, emergencyVetSearch: 'emergency vet 24h tokyo',
    dogRegulations: { leashRequired: true, offLeashAreas: false,
      publicTransport: 'Small dogs in carriers (under 10kg) allowed on trains and buses.',
      publicTransportFr: 'Petits chiens en sac (moins de 10kg) autorises dans les trains et bus.' }
  },
};

export const CATEGORIES = [
  { slug: 'parks', name: 'Dog Parks', nameFr: 'Parcs', icon: '🌳', color: '#22c55e' },
  { slug: 'restaurants', name: 'Restaurants', nameFr: 'Restaurants', icon: '🍽️', color: '#f97316' },
  { slug: 'cafes', name: 'Cafes', nameFr: 'Cafes', icon: '☕', color: '#f59e0b' },
  { slug: 'hotels', name: 'Hotels', nameFr: 'Hotels', icon: '🏨', color: '#8b5cf6' },
  { slug: 'beaches', name: 'Beaches', nameFr: 'Plages', icon: '🏖️', color: '#0ea5e9' },
  { slug: 'vets', name: 'Vets', nameFr: 'Veterinaires', icon: '🏥', color: '#ef4444' },
  { slug: 'groomers', name: 'Groomers', nameFr: 'Toiletteurs', icon: '✂️', color: '#ec4899' },
  { slug: 'shops', name: 'Pet Shops', nameFr: 'Animaleries', icon: '🛍️', color: '#a855f7' },
  { slug: 'activities', name: 'Activities', nameFr: 'Activites', icon: '🎾', color: '#3b82f6' },
];

export const DOG_FEATURES = {
  offLeashArea: { name: 'Off-Leash Area', nameFr: 'Zone sans laisse', icon: '🐕' },
  fenced: { name: 'Fenced', nameFr: 'Cloture', icon: '🔒' },
  waterAccess: { name: 'Water Access', nameFr: 'Acces eau', icon: '💧' },
  outdoorSeating: { name: 'Outdoor Seating', nameFr: 'Terrasse', icon: '☀️' },
  indoorAllowed: { name: 'Dogs Inside', nameFr: 'Chiens dedans', icon: '🏠' },
  waterBowls: { name: 'Water Bowls', nameFr: 'Gamelles', icon: '🥣' },
  dogMenu: { name: 'Dog Menu', nameFr: 'Menu chien', icon: '🦴' },
  treatsAvailable: { name: 'Treats', nameFr: 'Friandises', icon: '🍖' },
};

export const PRICING = {
  bronze: { price: 29, name: 'Bronze', features: ['Enhanced profile', 'Photo gallery', 'Contact info'] },
  silver: { price: 79, name: 'Silver', features: ['All Bronze features', 'Featured placement', 'Analytics'] },
  gold: { price: 149, name: 'Gold', features: ['All Silver features', 'Priority search', 'Lead gen', 'Verified badge'] },
};

export function getCityConfig(slug: string): CityConfig | undefined {
  return CITIES[slug.toLowerCase()];
}

export function getAllCitySlugs(): string[] {
  return Object.keys(CITIES);
}

export function getActiveCities(): CityConfig[] {
  return Object.values(CITIES).filter(c => c.isActive);
}

export function getCategoryBySlug(slug: string) {
  return CATEGORIES.find(c => c.slug === slug);
}

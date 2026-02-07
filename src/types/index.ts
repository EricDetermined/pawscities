// ============================================
// Core Types for PawsCities Multi-City Platform
// ============================================

// City Types
export interface City {
  id: string;
  slug: string;
  name: string;
  nameFr: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  currency: string;
  defaultZoom: number;
  heroImage: string;
  description: string;
  descriptionFr: string;
  neighborhoods: Neighborhood[];
  establishmentCount?: number;
}

export interface Neighborhood {
  slug: string;
  name: string;
  nameFr: string;
  latitude: number;
  longitude: number;
}

// Category Types
export type CategorySlug =
  | 'restaurants'
  | 'cafes'
  | 'hotels'
  | 'parks'
  | 'beaches'
  | 'vets'
  | 'groomers'
  | 'shops'
  | 'activities';

export interface Category {
  slug: CategorySlug;
  name: string;
  nameFr: string;
  icon: string;
  color: string;
}

// Establishment Types
export interface Establishment {
  id: string;
  slug: string;
  citySlug: string;
  categorySlug: CategorySlug;
  name: string;
  nameFr?: string;
  description: string;
  descriptionFr?: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  website?: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  reviewCount: number;
  images: string[];
  hours: BusinessHours;
  dogFeatures: DogFeatures;
  amenities: string[];
  neighborhood?: string;
  tier: 'free' | 'claimed' | 'premium';
  isVerified: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}

export interface DogFeatures {
  waterBowl: boolean;
  treats: boolean;
  outdoorSeating: boolean;
  indoorAllowed: boolean;
  offLeashArea: boolean;
  dogMenu: boolean;
  fenced: boolean;
  shadeAvailable: boolean;
  sizeRestrictions?: 'small' | 'medium' | 'large' | 'all';
  maxDogs?: number;
  notes?: string;
  notesFr?: string;
}

// Weather Types
export interface Weather {
  temp: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  windSpeed: number;
  recommendation: WeatherRecommendation;
}

export interface WeatherRecommendation {
  message: string;
  messageFr: string;
  level: 'great' | 'good' | 'caution' | 'warning';
}

// Filter Types
export interface FilterState {
  category: CategorySlug | null;
  neighborhood: string | null;
  priceLevel: number[] | null;
  dogFeatures: (keyof DogFeatures)[];
  searchQuery: string;
  sortBy: 'distance' | 'rating' | 'name' | 'price';
  isOpen: boolean | null;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  favoriteEstablishments: string[];
  visitedEstablishments: string[];
  homeCitySlug?: string;
  preferredLanguage: 'en' | 'fr';
  createdAt: string;
}

// Review Types
export interface Review {
  id: string;
  establishmentId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  dogFriendlinessRating: number;
  visitDate: string;
  photos: string[];
  helpful: number;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

// Geolocation Types
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// Search Result Types
export interface SearchResult {
  establishments: Establishment[];
  total: number;
  filters: FilterState;
  citySlug: string;
}

// Language Types
export type Language = 'en' | 'fr';

export interface TranslationStrings {
  [key: string]: {
    en: string;
    fr: string;
  };
}

// Map Types
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  category: CategorySlug;
  name: string;
  isSelected?: boolean;
  isFavorite?: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Analytics Types
export interface PageView {
  citySlug: string;
  establishmentId?: string;
  page: string;
  timestamp: string;
  sessionId: string;
}

export interface SearchEvent {
  citySlug: string;
  query: string;
  filters: FilterState;
  resultsCount: number;
  timestamp: string;
}

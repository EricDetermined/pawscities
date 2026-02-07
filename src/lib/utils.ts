import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format distance in kilometers or meters
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format price level (€ to €€€€)
 */
export function formatPriceLevel(level: number): string {
  return '€'.repeat(Math.min(Math.max(level, 1), 4));
}

/**
 * Generate slug from string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Get weather icon based on condition
 */
export function getWeatherIcon(condition: string): string {
  const icons: Record<string, string> = {
    clear: '☀️',
    sunny: '☀️',
    clouds: '☁️',
    cloudy: '☁️',
    rain: '🌧️',
    drizzle: '🌦️',
    thunderstorm: '⛈️',
    snow: '❄️',
    mist: '🌫️',
    fog: '🌫️',
  };
  return icons[condition.toLowerCase()] || '🌤️';
}

/**
 * Get weather recommendation for dogs
 */
export function getWeatherRecommendation(
  temp: number,
  condition: string
): { message: string; level: 'great' | 'good' | 'caution' | 'warning' } {
  if (temp < 0) {
    return {
      message: 'Very cold! Keep walks short and protect paws from ice.',
      level: 'warning',
    };
  }
  if (temp < 5) {
    return {
      message: 'Chilly weather. Consider a dog coat for short-haired breeds.',
      level: 'caution',
    };
  }
  if (temp > 30) {
    return {
      message: 'Hot weather! Walk early morning or evening. Bring water.',
      level: 'warning',
    };
  }
  if (temp > 25) {
    return {
      message: 'Warm day. Avoid hot pavement and bring water.',
      level: 'caution',
    };
  }
  if (condition.toLowerCase().includes('rain')) {
    return {
      message: 'Rainy weather. Many indoor-friendly places available!',
      level: 'caution',
    };
  }
  return {
    message: 'Perfect weather for outdoor adventures with your pup!',
    level: 'great',
  };
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  return phone.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '+$1 $2 $3 $4');
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format rating (e.g., 4.5 -> "4.5")
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Get opening status
 */
export function getOpeningStatus(
  hours: { open: string; close: string } | null
): { isOpen: boolean; message: string } {
  if (!hours) {
    return { isOpen: false, message: 'Hours not available' };
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [openHour, openMinute] = hours.open.split(':').map(Number);
  const [closeHour, closeMinute] = hours.close.split(':').map(Number);

  const openTime = openHour * 60 + openMinute;
  const closeTime = closeHour * 60 + closeMinute;

  const isOpen = currentTime >= openTime && currentTime < closeTime;

  if (isOpen) {
    const minutesUntilClose = closeTime - currentTime;
    if (minutesUntilClose <= 60) {
      return { isOpen: true, message: `Closes in ${minutesUntilClose} min` };
    }
    return { isOpen: true, message: 'Open now' };
  }

  if (currentTime < openTime) {
    return { isOpen: false, message: `Opens at ${hours.open}` };
  }

  return { isOpen: false, message: 'Closed' };
}

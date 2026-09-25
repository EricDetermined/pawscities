// Locale configuration for Paw Cities multilingual support.
// ADDITIVE + SAFE: `en` is the default and the source of truth. Any missing
// translation falls back to English (see messages.ts / client.tsx / server.ts).
// Locale is cookie-based (pc_locale), NOT URL-based — routes are unchanged.

export const SUPPORTED = ['en', 'fr', 'es', 'ja'] as const;
export type Locale = (typeof SUPPORTED)[number];

export const DEFAULT_LOCALE: Locale = 'en';

// Cookie that stores the visitor's explicit language choice (set by LanguageToggle).
export const LOCALE_COOKIE = 'pc_locale';

// Human-readable labels for the language switcher.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  ja: '日本語',
};

// Default language per city slug. A visitor who has NOT explicitly chosen a
// language sees the local language of the city. Keys use the canonical CITIES
// slugs (e.g. 'losangeles', 'newyork'); resolveLocale also normalizes hyphens.
export const CITY_DEFAULT_LOCALE: Record<string, Locale> = {
  paris: 'fr',
  geneva: 'fr',
  barcelona: 'es',
  tokyo: 'ja',
  london: 'en',
  sydney: 'en',
  newyork: 'en',
  losangeles: 'en',
  atlanta: 'en',
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED as readonly string[]).includes(value);
}

/**
 * Resolve the effective locale.
 * - If the visitor explicitly chose a language (valid cookie), that always wins
 *   so an English-toggled user stays English everywhere.
 * - Otherwise fall back to the city's default language (if a city slug is given).
 * - Otherwise English.
 */
export function resolveLocale(
  cookieLocale: string | null | undefined,
  citySlug?: string | null
): Locale {
  if (isSupportedLocale(cookieLocale)) return cookieLocale;
  if (citySlug) {
    const lower = citySlug.toLowerCase();
    const byCity =
      CITY_DEFAULT_LOCALE[lower] ?? CITY_DEFAULT_LOCALE[lower.replace(/-/g, '')];
    if (byCity) return byCity;
  }
  return DEFAULT_LOCALE;
}

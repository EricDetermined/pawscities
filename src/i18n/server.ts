// Server-side locale helpers. Read the pc_locale cookie via next/headers.
// Use in Server Components / Route Handlers only.

import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isSupportedLocale,
  resolveLocale,
  type Locale,
} from './locales';
import { getMessages, translate } from './messages';

/** Raw cookie value (may be null / invalid). */
export function getCookieLocale(): string | null {
  try {
    return cookies().get(LOCALE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * The explicit locale from the cookie, validated against SUPPORTED.
 * Defaults to English. This does NOT apply city defaults — use getServerLocale
 * for city-aware resolution.
 */
export function getLocale(): Locale {
  const cookieLocale = getCookieLocale();
  return isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

/**
 * City-aware locale: explicit cookie choice wins, otherwise the city's default
 * language, otherwise English.
 */
export function getServerLocale(citySlug?: string | null): Locale {
  return resolveLocale(getCookieLocale(), citySlug);
}

// Re-export for convenient server-side use: t(locale, key, fallbackToEn, vars)
export { getMessages, translate as t };
export type { Locale };

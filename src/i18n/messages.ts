// Message catalogs + translation lookup. English is the source of truth; any
// missing key in another locale falls back to English, and if English is also
// missing the key string itself is returned (so nothing renders blank).

import en from './messages/en.json';
import fr from './messages/fr.json';
import es from './messages/es.json';
import ja from './messages/ja.json';
import ca from './messages/ca.json';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from './locales';

export type Messages = Record<string, string>;

export const CATALOGS: Record<Locale, Messages> = {
  en: en as Messages,
  fr: fr as Messages,
  es: es as Messages,
  ja: ja as Messages,
  ca: ca as Messages,
};

export function getMessages(locale: Locale): Messages {
  return CATALOGS[locale] || CATALOGS[DEFAULT_LOCALE];
}

/**
 * Translate a key for a locale.
 * @param locale target locale
 * @param key message key
 * @param fallbackToEn when true (default) and the key is missing/blank in the
 *   target locale, return the English value. If English is also missing, return
 *   the key itself so a string is always produced.
 * @param vars optional {name} placeholder substitutions.
 */
export function translate(
  locale: Locale,
  key: string,
  fallbackToEn: boolean = true,
  vars?: Record<string, string | number>
): string {
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const primary = CATALOGS[safeLocale]?.[key];
  let value: string | undefined =
    typeof primary === 'string' && primary.length > 0 ? primary : undefined;

  if (value === undefined && fallbackToEn) {
    const enValue = CATALOGS[DEFAULT_LOCALE]?.[key];
    if (typeof enValue === 'string' && enValue.length > 0) value = enValue;
  }

  if (value === undefined) return key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
}

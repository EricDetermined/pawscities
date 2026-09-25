// Localized CONTENT helpers (as opposed to UI message strings).
//
// SAFE SUBSET: only `description_fr` / `name_fr` exist in the establishments
// table today. es/ja translated columns do NOT exist, and events have NO
// translation columns — so those always fall back to English. Business and
// event NAMES are proper nouns and always render as-is.

import type { Locale } from './locales';

interface LocalizableEstablishment {
  description?: string | null;
  descriptionFr?: string | null;
}

/**
 * Returns the French description when locale === 'fr' and a non-empty
 * descriptionFr is available; otherwise the English description. es/ja fall
 * back to English because no translated columns exist yet.
 */
export function localizedDescription(
  est: LocalizableEstablishment | null | undefined,
  locale: Locale
): string {
  if (!est) return '';
  if (locale === 'fr') {
    const fr = est.descriptionFr;
    if (typeof fr === 'string' && fr.trim().length > 0) return fr;
  }
  return est.description ?? '';
}

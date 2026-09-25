// Localized CONTENT helpers (as opposed to UI message strings).
//
// Machine-translated description columns now exist for establishments and
// events (Phase 2 i18n). Each row carries a base English `description` plus, per
// target locale, a translated column populated by the translate-content cron:
//   fr -> description_fr, es -> description_es, ja -> description_ja,
//   ca -> description_ca. English (en) and any other locale use the base.
//
// Business and event NAMES are proper nouns and always render as-is — only
// descriptions are translated.

import type { Locale } from './locales';

type Nullable = string | null | undefined;

// Accepts either shape we render from:
//   - raw DB rows using snake_case columns (events)
//   - mapped app objects using camelCase (Establishment)
// All fields optional so a partial/undefined entity is always safe.
interface LocalizableContent {
  description?: Nullable;
  // snake_case (raw DB rows)
  description_fr?: Nullable;
  description_es?: Nullable;
  description_ja?: Nullable;
  description_ca?: Nullable;
  // camelCase (mapped objects)
  descriptionFr?: Nullable;
  descriptionEs?: Nullable;
  descriptionJa?: Nullable;
  descriptionCa?: Nullable;
}

// Locales we translate descriptions into. Everything else (incl. 'en') falls
// back to the base English description. For each, list the candidate columns to
// try in priority order (snake_case first, then camelCase).
const LOCALE_PICKERS: Record<string, (e: LocalizableContent) => Nullable[]> = {
  fr: (e) => [e.description_fr, e.descriptionFr],
  es: (e) => [e.description_es, e.descriptionEs],
  ja: (e) => [e.description_ja, e.descriptionJa],
  ca: (e) => [e.description_ca, e.descriptionCa],
};

function nonEmpty(value: Nullable): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Returns the localized description for an establishment or event.
 *
 * Reads the translated column for the given locale when it holds a non-empty
 * string, otherwise falls back to the base English `description`. Null-safe: a
 * missing entity, missing fields, or an untranslated locale all degrade cleanly
 * to English (or '').
 */
export function localizedDescription(
  entity: LocalizableContent | null | undefined,
  locale: Locale
): string {
  if (!entity) return '';
  const base = nonEmpty(entity.description) ?? '';

  const pick = LOCALE_PICKERS[locale];
  if (!pick) return base; // 'en' or anything unsupported

  for (const candidate of pick(entity)) {
    const value = nonEmpty(candidate);
    if (value) return value;
  }
  return base;
}

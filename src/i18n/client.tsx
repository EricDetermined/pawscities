'use client';

// Client-side i18n: a small context provider seeded with a server-resolved
// locale, plus a useT() hook. Falls back to English for any missing key.

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from './locales';
import { translate } from './messages';

export type TFunction = (
  key: string,
  vars?: Record<string, string | number>,
  fallbackToEn?: boolean
) => string;

interface I18nContextValue {
  locale: Locale;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key, vars) => translate(DEFAULT_LOCALE, key, true, vars),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const safe = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const value = useMemo<I18nContextValue>(
    () => ({
      locale: safe,
      t: (key, vars, fallbackToEn = true) => translate(safe, key, fallbackToEn, vars),
    }),
    [safe]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

/** Returns a stable translation function bound to the current locale. */
export function useT(): TFunction {
  const { t } = useContext(I18nContext);
  return useCallback<TFunction>((key, vars, fallbackToEn = true) => t(key, vars, fallbackToEn), [t]);
}

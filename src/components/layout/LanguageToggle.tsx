'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SUPPORTED, LOCALE_LABELS, LOCALE_COOKIE, type Locale } from '@/i18n/locales';
import { useLocale, useT } from '@/i18n/client';

// Compact language switcher (globe + current language) for the site header.
// Selecting a language sets the pc_locale cookie (path=/, ~1yr) and calls
// router.refresh() so server components re-render in the new locale.
export function LanguageToggle() {
  const router = useRouter();
  const current = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const selectLocale = (locale: Locale) => {
    // ~1 year, site-wide
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setOpen(false);
    if (locale !== current) router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('common.language')}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
        </svg>
        <span className="hidden sm:inline">{LOCALE_LABELS[current]}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl border border-gray-500/40 shadow-lg py-1 z-50" role="menu">
          {SUPPORTED.map(locale => (
            <button
              key={locale}
              type="button"
              role="menuitemradio"
              aria-checked={current === locale}
              onClick={() => selectLocale(locale)}
              className={`flex items-center justify-between w-full px-4 py-2 text-sm text-left transition-colors ${
                current === locale ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {LOCALE_LABELS[locale]}
              {current === locale && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

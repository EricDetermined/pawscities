'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogoLink } from '@/components/Logo';
import { usePathname } from 'next/navigation';
import { UserMenu } from '@/components/auth/UserMenu';
import { CITIES } from '@/lib/cities-config';

// Cities alphabetically for the dropdown (2026-09-04 heuristic eval: faster
// navigation to available cities + predictable ordering).
const cityLinks = Object.values(CITIES)
  .map(c => ({ name: c.name, href: `/${c.slug}` }))
  .sort((a, b) => a.name.localeCompare(b.name));

const navigation = [
  { name: 'Community', href: '/dogs' },
  { name: 'Events', href: '/events' },
  { name: 'About', href: '/about' },
  { name: 'FAQ', href: '/faq' },
  { name: 'For Business', href: '/for-business' },
]

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const citiesRef = useRef<HTMLDivElement>(null);

  // Close the cities dropdown on outside click / Escape / route change.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (citiesRef.current && !citiesRef.current.contains(e.target as Node)) setCitiesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCitiesOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);
  useEffect(() => { setCitiesOpen(false); setMobileMenuOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      {/* Skip link (2026-09-04 heuristic eval): first focusable element, visible on focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-orange-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <LogoLink variant="horizontal" size="md" />

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main">
            {/* Cities dropdown */}
            <div className="relative" ref={citiesRef}>
              <button
                onClick={() => setCitiesOpen(o => !o)}
                aria-expanded={citiesOpen}
                aria-haspopup="true"
                className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${
                  citiesOpen || cityLinks.some(c => pathname === c.href)
                    ? 'text-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Explore Cities
                <svg className={`w-4 h-4 transition-transform ${citiesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {citiesOpen && (
                <div className="absolute left-0 top-full mt-2 w-52 bg-white rounded-xl border border-gray-500/40 shadow-lg py-2" role="menu">
                  {cityLinks.map(city => (
                    <Link
                      key={city.href}
                      href={city.href}
                      role="menuitem"
                      className={`block px-4 py-2 text-sm transition-colors ${
                        pathname === city.href ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {city.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right side: User Menu + Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <UserMenu />

            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -mr-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="px-4 py-3 space-y-1" aria-label="Mobile">
            <p className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Cities</p>
            <div className="grid grid-cols-2 gap-x-2">
              {cityLinks.map(city => (
                <Link
                  key={city.href}
                  href={city.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname === city.href ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {city.name}
                </Link>
              ))}
            </div>
            <p className="px-3 pt-3 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Menu</p>
            {[...navigation,
              { name: 'Your Feed', href: '/feed' },
              { name: 'My Dogs', href: '/profile/dogs' },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

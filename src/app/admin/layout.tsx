'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// ── Nav structure with grouped sections ─────────────────────────────────────

interface NavItem {
  title: string;
  href: string;
  icon: string;
  badgeKey?: string; // maps to a key in the badge counts object
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Review',
    items: [
      { title: 'Dashboard', href: '/admin', icon: '\u{1F3AF}' },
      { title: 'Events', href: '/admin/events', icon: '\u{1F4C5}', badgeKey: 'events' },
      { title: 'Creatives', href: '/admin/creatives', icon: '\u{1F3A8}', badgeKey: 'creatives' },
      { title: 'Discovery', href: '/admin/social', icon: '\u{1F50D}', badgeKey: 'discovery' },
      { title: 'Business Claims', href: '/admin/claims', icon: '\u{1F4CB}', badgeKey: 'claims' },
      { title: 'Photo Moderation', href: '/admin/photos', icon: '\u{1F4F8}', badgeKey: 'photos' },
      { title: 'Validation', href: '/admin/validation', icon: '✅', badgeKey: 'validation' },
    ],
  },
  {
    label: 'Content',
    items: [
      { title: 'Social Media', href: '/admin/social', icon: '\u{1F4F1}' },
      { title: 'Subscribers', href: '/admin/subscribers', icon: '\u{1F4E7}' },
      { title: 'Ambassadors', href: '/admin/ambassadors', icon: '\u{1F43E}' },
      { title: 'Community', href: '/admin/community', icon: '\u{1F415}' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { title: 'Cities', href: '/admin/cities', icon: '\u{1F3D9}️' },
      { title: 'Establishments', href: '/admin/establishments', icon: '\u{1F4CD}' },
      { title: 'Categories', href: '/admin/categories', icon: '\u{1F3F7}️' },
      { title: 'Users', href: '/admin/users', icon: '\u{1F465}' },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Research Agent', href: '/admin/research', icon: '\u{1F916}' },
      { title: 'Analytics', href: '/admin/analytics', icon: '\u{1F4C8}' },
      { title: 'Health Monitor', href: '/admin/health', icon: '\u{1FA7A}' },
      { title: 'Settings', href: '/admin/settings', icon: '⚙️' },
    ],
  },
];

// Flatten for dedup — "Discovery" and "Social Media" share /admin/social
// We keep both in the nav but won't double-highlight

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  // Detect mobile vs desktop
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fetch badge counts on mount and every 60s
  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setBadgeCounts({
          events: data.events?.pending || 0,
          creatives: data.creatives?.pendingReview || 0,
          discovery: data.discovery?.needsReview || 0,
          claims: data.stats?.pendingClaims || 0,
          photos: data.stats?.pendingPhotos || 0,
          validation: data.stats?.pendingValidation || 0,
        });
      } catch { /* silent */ }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  const closeSidebar = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const totalPending = Object.values(badgeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Header */}
      <header className="bg-white border-b h-16 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-2xl">{'\u{1F43E}'}</span>
              <span className="font-display text-xl font-bold text-primary-600">Paw Cities</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">Admin</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {totalPending > 0 && (
              <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium hover:bg-orange-100 transition-colors">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                {totalPending} to review
              </Link>
            )}
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 hidden sm:flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Site
            </Link>
            <div className="h-8 w-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-medium">
              A
            </div>
          </div>
        </div>
      </header>

      {/* Mobile backdrop overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-16 bottom-0 bg-white border-r transition-all duration-300 z-40 overflow-y-auto',
          isMobile
            ? cn('w-64', sidebarOpen ? 'left-0' : '-left-64')
            : cn('left-0', sidebarOpen ? 'w-64' : 'w-16')
        )}
      >
        <nav className="p-3 space-y-4">
          {navSections.map((section, sIdx) => (
            <div key={section.label}>
              {(sidebarOpen || isMobile) && sIdx > 0 && (
                <div className="border-t my-2" />
              )}
              {(sidebarOpen || isMobile) && (
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href));
                  const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] || 0 : 0;

                  return (
                    <Link
                      key={item.href + item.title}
                      href={item.href}
                      onClick={closeSidebar}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <span className="text-lg shrink-0">{item.icon}</span>
                      {(sidebarOpen || isMobile) && (
                        <>
                          <span className="flex-1">{item.title}</span>
                          {badgeCount > 0 && (
                            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                              {badgeCount}
                            </span>
                          )}
                        </>
                      )}
                      {!sidebarOpen && !isMobile && badgeCount > 0 && (
                        <span className="absolute left-10 top-0.5 w-2 h-2 bg-orange-500 rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        {(sidebarOpen || isMobile) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
            <div className="text-xs text-gray-500">
              <p>Paw Cities Admin v2.0</p>
              <p>Unified Command Center</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
          isMobile ? 'ml-0' : sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

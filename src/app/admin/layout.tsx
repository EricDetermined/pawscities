'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: '\u{1F4CA}',
  },
  {
    title: 'Cities',
    href: '/admin/cities',
    icon: '\u{1F3D9}\uFE0F',
  },
  {
    title: 'Establishments',
    href: '/admin/establishments',
    icon: '\u{1F4CD}',
  },
  {
    title: 'Categories',
    href: '/admin/categories',
    icon: '\u{1F3F7}\uFE0F',
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: '\u{1F465}',
  },
  {
    title: 'Research Agent',
    href: '/admin/research',
    icon: '\u{1F916}',
  },
  {
    title: 'Photo Moderation',
    href: '/admin/photos',
    icon: '\u{1F4F8}',
  },
  {
    title: 'Business Claims',
    href: '/admin/claims',
    icon: '\u{1F4CB}',
  },
  {
    title: 'Validation Queue',
    href: '/admin/validation',
    icon: '\u2705',
  },
  {
    title: 'Social Media',
    href: '/admin/social',
    icon: '\u{1F4F1}',
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: '\u{1F4C8}',
  },
  {
    title: 'Health Monitor',
    href: '/admin/health',
    icon: '\u{1FA7A}',
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: '\u2699\uFE0F',
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile vs desktop
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-open sidebar on desktop, close on mobile
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  const closeSidebar = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

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
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-2xl">{'\u{1F43E}'}</span>
              <span className="font-display text-xl font-bold text-primary-600">
                Paw Cities
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                Admin
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 hidden sm:flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
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
          // Mobile: slide in/out from left, full overlay
          isMobile
            ? cn('w-64', sidebarOpen ? 'left-0' : '-left-64')
            // Desktop: collapse to icon-only
            : cn('left-0', sidebarOpen ? 'w-64' : 'w-16')
        )}
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <span className="text-xl">{item.icon}</span>
                {(sidebarOpen || isMobile) && (
                  <span className="font-medium">{item.title}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        {(sidebarOpen || isMobile) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
            <div className="text-xs text-gray-500">
              <p>Paw Cities Admin v1.0</p>
              <p>Phase 2 - Database & Management</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
          // Mobile: always full width
          isMobile
            ? 'ml-0'
            : sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

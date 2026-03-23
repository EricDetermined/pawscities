'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  {
    title: 'Overview',
    href: '/business',
    icon: '📊',
  },
  {
    title: 'Edit Listing',
    href: '/business/listing',
    icon: '✏️',
  },
  {
    title: 'Photos',
    href: '/business/photos',
    icon: '📸',
  },
  {
    title: 'Reviews',
    href: '/business/reviews',
    icon: '⭐',
  },
  {
    title: 'Analytics',
    href: '/business/analytics',
    icon: '📈',
  },
  {
    title: 'Upgrade to Premium',
    href: '/business/upgrade',
    icon: '👑',
  },
  {
    title: 'Help Guide',
    href: '/business/guide',
    icon: '📖',
  },
];

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userInitial, setUserInitial] = useState('');

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

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  const closeSidebar = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.name || user.email || '';
        if (user.user_metadata?.name) {
          setUserInitial(
            name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          );
        } else if (user.email) {
          setUserInitial(user.email.charAt(0).toUpperCase());
        }
      }
    });
  }, []);

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
            <Link href="/business" className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-orange-600">
                Paw Cities
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                Business
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
              View Public Listing
            </Link>
            <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-medium text-sm">
              {userInitial || '?'}
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
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/business' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-orange-50 text-orange-700'
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
              <p>Paw Cities Business v1.0</p>
              <p>Claim & Manage Your Listing</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
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

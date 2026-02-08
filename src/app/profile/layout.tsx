'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';

const profileNav = [
  { name: 'Profile', href: '/profile' },
  { name: 'My Dogs', href: '/profile/dogs' },
  { name: 'Favorites', href: '/profile/favorites' },
  { name: 'Check-ins', href: '/profile/checkins' },
  { name: 'Reviews', href: '/profile/reviews' },
  { name: 'Settings', href: '/profile/settings' },
];

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="bg-white rounded-xl shadow-sm p-4 space-y-1">
              {profileNav.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-orange-50 text-orange-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

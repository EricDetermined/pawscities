'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import { isAdmin } from '@/lib/admin';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Cities', href: '/#cities' },
];

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="text-xl font-bold text-orange-600">PawsCities</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
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
            {user && isAdmin(user.email) && (
              <Link
                href="/admin"
                className={`text-sm font-medium transition-colors ${
                  pathname.startsWith('/admin')
                    ? 'text-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

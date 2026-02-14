'use client';

import Link from 'next/link';
import { LogoLink } from '@/components/Logo';
import { usePathname } from 'next/navigation';
import { UserMenu } from '@/components/auth/UserMenu';

const navigation = [
  { name: 'For Business', href: '/for-business' },
]

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <LogoLink variant="horizontal" size="md" />

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
          </nav>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

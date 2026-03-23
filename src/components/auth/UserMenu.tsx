'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

export function UserMenu() {
  const { user, dbRole, isLoading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  const initials = user.user_metadata?.name
    ? user.user_metadata.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user.email?.charAt(0).toUpperCase() || '?';

  const isBusiness = dbRole === 'BUSINESS' || dbRole === 'ADMIN';
  const isAdmin = dbRole === 'ADMIN';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none"
      >
        <div className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-medium text-sm">
          {initials}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-56 max-w-[16rem] bg-white rounded-xl shadow-lg border py-2 z-50">
          <div className="px-4 py-2 border-b">
            <p className="font-medium text-gray-900 truncate">
              {user.user_metadata?.name || 'Dog Lover'}
            </p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>

          {/* Business & Admin links */}
          {isBusiness && (
            <div className="py-1 border-b">
              <Link
                href="/business"
                className="block px-4 py-2 text-sm text-orange-700 font-medium hover:bg-orange-50"
                onClick={() => setIsOpen(false)}
              >
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Business Dashboard
                </span>
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="block px-4 py-2 text-sm text-purple-700 font-medium hover:bg-purple-50"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Panel
                  </span>
                </Link>
              )}
            </div>
          )}

          <div className="py-1">
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              My Profile
            </Link>
            <Link
              href="/profile/dogs"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              My Dogs
            </Link>
            <Link
              href="/profile/favorites"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Saved Places
            </Link>
            <Link
              href="/profile/reviews"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              My Reviews
            </Link>
          </div>

          <div className="border-t py-1">
            <Link
              href="/profile/settings"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Settings
            </Link>
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

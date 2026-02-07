'use client';

import React from 'react';
import { Input } from '@/components/ui';
import type { Language } from '@/types';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  lang: Language;
  className?: string;
}

export function SearchBar({ value, onChange, lang, className }: SearchBarProps) {
  const placeholder = lang === 'fr'
    ? 'Rechercher des lieux...'
    : 'Search for places...';

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      icon={
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
    />
  );
}

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CATEGORY_LIST, getCategoryName } from '@/lib/categories';
import type { CategorySlug, Language } from '@/types';

interface CategoryFilterProps {
  selectedCategory: CategorySlug | null;
  onCategoryChange: (category: CategorySlug | null) => void;
  lang: Language;
}

export function CategoryFilter({
  selectedCategory,
  onCategoryChange,
  lang,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All button */}
      <button
        onClick={() => onCategoryChange(null)}
        className={cn(
          'filter-chip',
          selectedCategory === null && 'active'
        )}
      >
        🐾 {lang === 'fr' ? 'Tous' : 'All'}
      </button>

      {/* Category buttons */}
      {CATEGORY_LIST.map((category) => (
        <button
          key={category.slug}
          onClick={() => onCategoryChange(category.slug)}
          className={cn(
            'filter-chip',
            selectedCategory === category.slug && 'active'
          )}
        >
          {category.icon} {getCategoryName(category.slug, lang)}
        </button>
      ))}
    </div>
  );
}

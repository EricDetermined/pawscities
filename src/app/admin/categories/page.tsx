'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  establishmentCount?: number;
}

const categoryIcons: Record<string, string> = {
  restaurants: '\u{1F37D}\uFE0F',
  cafes: '\u2615',
  parks: '\u{1F333}',
  hotels: '\u{1F3E8}',
  vets: '\u{1F3E5}',
  groomers: '\u2702\uFE0F',
  shops: '\u{1F6CD}\uFE0F',
  activities: '\u{1F3BE}',
  beaches: '\u{1F3D6}\uFE0F',
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/categories');
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      const data = await response.json();
      setCategories(data.categories || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600">
            Manage establishment categories across all cities
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? [...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
                <div className="h-8 w-8 bg-gray-200 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/3"></div>
              </div>
            ))
          : categories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-xl border p-6 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-3xl mb-3 block">
                      {categoryIcons[category.slug] || '\u{1F4CD}'}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Slug: <code className="bg-gray-100 px-1 rounded">{category.slug}</code>
                    </p>
                  </div>
                  <div className="text-right">
                    {category.establishmentCount !== undefined && (
                      <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                        {category.establishmentCount} places
                      </div>
                    )}
                  </div>
                </div>
                {category.sortOrder !== undefined && (
                  <p className="text-xs text-gray-400 mt-3">
                    Sort order: {category.sortOrder}
                  </p>
                )}
              </div>
            ))}
      </div>

      {!loading && categories.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500">No categories found</p>
        </div>
      )}
    </div>
  );
}

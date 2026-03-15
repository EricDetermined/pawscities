'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui';
import type { CityConfig } from '@/lib/cities-config';
import type { Establishment, CategorySlug } from '@/types';
import { PremiumCard } from '@/components/ListingBadges';

// Dynamic import for MapView to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/map/MapView').then(mod => ({ default: mod.MapView })), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center"><span className="text-gray-400">Loading map...</span></div>,
});

// Client-side emoji map to avoid UTF-8 serialization issues across the RSC boundary
const CATEGORY_ICONS: Record<string, string> = {
  parks: '\u{1F333}',        // ð³
  restaurants: '\u{1F37D}\uFE0F', // ð½ï¸
  cafes: '\u2615',           // â
  hotels: '\u{1F3E8}',       // ð¨
  beaches: '\u{1F3D6}\uFE0F', // ðï¸
  vets: '\u{1F3E5}',         // ð¥
  groomers: '\u2702\uFE0F',  // âï¸
  shops: '\u{1F6CD}\uFE0F',  // ðï¸
  activities: '\u{1F3BE}',   // ð¾
  walkers: '\u{1F9AE}',      // ð¦®
  trainers: '\u{1F393}',     // ð
  daycare: '\u{1F3E0}',      // ð 
};

function getCategoryIcon(slug: string): string {
  return CATEGORY_ICONS[slug] || '\u{1F43E}'; // ð¾ fallback
}

// Fallback image for when Unsplash images fail to load
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop';

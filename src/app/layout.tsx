import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Navigation } from 'A/components/layout/Navigation';
  
export const metadata: Metadata = {
  title: 'Paws Cities',
  description: 'Find dogs and establishments in your city',
};

export default function RootLayout({
  children,
}: 
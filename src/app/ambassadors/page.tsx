import { Metadata } from 'next';
import { Suspense } from 'react';
import AmbassadorPageClient from './AmbassadorPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Become an Ambassador - Paw Cities',
  description: 'Join the Paw Cities Ambassador Program. Represent your city, earn rewards on paid business subscriptions, and help build the dog-friendly community.',
  openGraph: {
    title: 'Become a Paw Cities Ambassador',
    description: 'Join our global team of dog-loving city ambassadors. Earn commission, get exclusive perks, and shape the Paw Cities experience in your city.',
    images: ['/ambassador-badge.svg'],
  },
};

export default function AmbassadorsPage() {
  return <AmbassadorPageClient />;
}

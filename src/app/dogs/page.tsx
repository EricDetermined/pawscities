import { Metadata } from 'next';
import { Suspense } from 'react';
import { CommunityDirectoryClient } from './CommunityDirectoryClient';

export const metadata: Metadata = {
  title: 'Meet the Dogs | Paw Cities',
  description:
    'Meet the dogs of Paw Cities. Browse dog profiles by city, follow their owners, and build your local dog community.',
};

export default function DogsDirectoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <CommunityDirectoryClient />
    </Suspense>
  );
}

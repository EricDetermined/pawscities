import { Suspense } from 'react';
import ForBusinessClient from './ForBusinessClient';

export const metadata = {
  title: 'For Business - Grow Your Dog-Friendly Business',
  description: 'Manage your listing on Paw Cities. Reach thousands of dog owners looking for pet-friendly establishments. Free to get started.',
};

export default function ForBusinessPage() {
  return (
    <Suspense>
      <ForBusinessClient />
    </Suspense>
  );
}

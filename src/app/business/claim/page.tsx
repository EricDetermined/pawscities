import { Suspense } from 'react';
import ClaimPageClient from './ClaimPageClient';

export const metadata = {
  title: 'Claim Your Business | Paw Cities',
  description: 'Claim and manage your dog-friendly business listing on Paw Cities.',
};

export default function ClaimBusinessPage() {
  return (
    <Suspense>
      <ClaimPageClient />
    </Suspense>
  );
}

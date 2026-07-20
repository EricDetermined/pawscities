import { Metadata } from 'next';
import { AmbassadorDashboardClient } from './AmbassadorDashboardClient';

export const metadata: Metadata = {
  title: 'Ambassador Dashboard | Paw Cities',
  description: 'Your referral link and community impact.',
};

export default function AmbassadorDashboardPage() {
  return <AmbassadorDashboardClient />;
}

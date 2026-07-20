import { Metadata } from 'next';
import { WelcomeClient } from './WelcomeClient';

export const metadata: Metadata = {
  title: 'Welcome | Paw Cities',
  description: 'Get set up on Paw Cities in under two minutes.',
};

export default function WelcomePage() {
  return <WelcomeClient />;
}

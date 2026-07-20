import { Metadata } from 'next';
import { FeedClient } from './FeedClient';

export const metadata: Metadata = {
  title: 'Your Feed | Paw Cities',
  description: 'Check-ins and reviews from the dog owners you follow.',
};

export default function FeedPage() {
  return <FeedClient />;
}

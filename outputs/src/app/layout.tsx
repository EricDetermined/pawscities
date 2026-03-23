import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PawsCities - Dog-Friendly Places Worldwide',
  description: 'Discover dog-friendly cafes, restaurants, parks, and more in cities around the world.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { AuthProvider } from '@/components/auth/AuthProvider';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: {
    default: 'Paw Cities - Dog-Friendly Places Worldwide',
    template: '%s | Paw Cities',
  },
  description: 'Discover dog-friendly restaurants, cafes, parks, hotels and more in Geneva, Paris, London, and beyond.',
  keywords: ['dog-friendly', 'pet-friendly', 'restaurants', 'cafes', 'parks', 'hotels'],
  authors: [{ name: 'Paw Cities' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://pawcities.com',
    siteName: 'Paw Cities',
    title: 'Paw Cities - Dog-Friendly Places Worldwide',
    description: 'Discover dog-friendly restaurants, cafes, parks, hotels and more.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

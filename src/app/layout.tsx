import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { AuthProvider } from '@/components/auth/AuthProvider';
import '@/styles/globals.css';
import { Header } from '@/components/layout/Header';

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
  keywords: ['dog-friendly', 'pet-friendly', 'restaurants', 'cafes', 'parks', 'hotels', 'dog parks', 'pet-friendly travel'],
  authors: [{ name: 'Paw Cities' }],
  alternates: { canonical: 'https://pawcities.com' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://pawcities.com',
    siteName: 'Paw Cities',
    title: 'Paw Cities - Dog-Friendly Places Worldwide',
    description: 'Discover dog-friendly restaurants, cafes, parks, hotels and more in Geneva, Paris, London, and beyond.',
    images: [{ url: 'https://pawcities.com/images/og-default.png', width: 1200, height: 630, alt: 'Paw Cities - Dog-Friendly Places Worldwide' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paw Cities - Dog-Friendly Places Worldwide',
    description: 'Discover dog-friendly restaurants, cafes, parks, hotels and more in Geneva, Paris, London, and beyond.',
    images: ['https://pawcities.com/images/og-default.png'],
  },
  other: {
    'facebook-domain-verification': '0n5yl6b7ey6vmmb96xmxo67rhy05r2',
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
        {/* Site-wide JSON-LD: Organization + WebSite with SearchAction */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Paw Cities',
          url: 'https://pawcities.com',
          logo: 'https://pawcities.com/images/og-default.png',
          description: 'The global guide to dog-friendly restaurants, cafes, parks, hotels, and events.',
          sameAs: [
            'https://www.instagram.com/pawcities',
          ],
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Paw Cities',
          url: 'https://pawcities.com',
          description: 'Discover dog-friendly places worldwide.',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://pawcities.com/explore?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }) }} />
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

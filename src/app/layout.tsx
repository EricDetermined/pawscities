import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PawsCities - Find Dog-Friendly Places',
  description: 'Discover the best dog-friendly restaurants, parks, cafes and more in cities across America.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-amber-600 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <a href="/" className="text-2xl font-bold">🐕 PawsCities</a>
            <div className="space-x-4">
              <a href="/cities" className="hover:underline">Cities</a>
              <a href="/about" className="hover:underline">About</a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="bg-gray-800 text-white p-8 mt-12">
          <div className="container mx-auto text-center">
            <p>© 2024 PawsCities. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  )
}

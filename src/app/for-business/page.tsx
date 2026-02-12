import Link from 'next/link';
import { UserMenu } from '@/components/auth/UserMenu';

export const metadata = {
  title: 'For Business - Grow Your Dog-Friendly Business',
  description: 'Manage your listing on Paw Cities. Reach thousands of dog owners looking for pet-friendly establishments. Free to get started.',
};

export default function ForBusinessPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-orange-600">Paw Cities</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">Home</Link>
              <Link href="/explore" className="text-sm font-medium text-gray-600 hover:text-gray-900">Explore</Link>
              <Link href="/for-business" className="text-sm font-medium text-orange-600">For Business</Link>
            </nav>
            <div className="flex items-center gap-4">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-24 px-4">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="container mx-auto max-w-5xl relative">
          <div className="text-center">
            <span className="inline-block px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              Free to get started
            </span>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Grow Your Dog-Friendly<br />Business
            </h1>
            <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto mb-10 leading-relaxed">
              Reach thousands of dog owners actively searching for pet-friendly places. Manage your listing, track engagement, and stand out from the competition.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login?redirect=/business/claim"
                className="px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-colors shadow-lg"
              >
                Get Started Free
              </Link>
              <a
                href="#pricing"
                className="px-8 py-4 border-2 border-white/30 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
              >
                View Pricing
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gray-900 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-center">
            <div>
              <p className="text-2xl md:text-3xl font-bold">265+</p>
              <p className="text-sm text-gray-400">Listed Establishments</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold">8</p>
              <p className="text-sm text-gray-400">Cities Worldwide</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold">1000s</p>
              <p className="text-sm text-gray-400">Monthly Dog Owners</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold">Free</p>
              <p className="text-sm text-gray-400">To Get Started</p>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why List on Paw Cities?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Dog owners plan their outings around pet-friendly venues. Make sure they find you.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 border border-orange-100">
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center text-2xl mb-5">🎯</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Reach Dog Owners</h3>
              <p className="text-gray-600 leading-relaxed">
                Connect directly with pet owners who are actively searching for dog-friendly places to eat, drink, stay, and explore.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-5">📊</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Track Your Impact</h3>
              <p className="text-gray-600 leading-relaxed">
                See how many people view your listing, click for directions, call your business, and visit your website.
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center text-2xl mb-5">⭐</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Build Your Reputation</h3>
              <p className="text-gray-600 leading-relaxed">
                Collect and respond to reviews from dog owners. Showcase your dog-friendly amenities and earn verified badges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">Get started in just three simple steps</p>
          </div>
          <div className="space-y-8">
            <div className="flex items-start gap-6 bg-white rounded-xl p-6 border shadow-sm">
              <div className="w-12 h-12 bg-orange-600 text-white rounded-xl flex items-center justify-center text-xl font-bold shrink-0">1</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Create a Free Account</h3>
                <p className="text-gray-600">Sign up for Paw Cities in under a minute. No credit card required.</p>
              </div>
            </div>
            <div className="flex items-start gap-6 bg-white rounded-xl p-6 border shadow-sm">
              <div className="w-12 h-12 bg-orange-600 text-white rounded-xl flex items-center justify-center text-xl font-bold shrink-0">2</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Claim Your Listing</h3>
                <p className="text-gray-600">Search for your establishment, submit a quick verification, and start managing your presence.</p>
              </div>
            </div>
            <div className="flex items-start gap-6 bg-white rounded-xl p-6 border shadow-sm">
              <div className="w-12 h-12 bg-orange-600 text-white rounded-xl flex items-center justify-center text-xl font-bold shrink-0">3</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Manage &amp; Grow</h3>
                <p className="text-gray-600">Update your details, upload photos, respond to reviews, and upgrade to Premium for advanced features.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start free and upgrade when you are ready to grow faster
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">Everything you need to get started</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="text-green-500 font-bold">✓</span> Claim &amp; manage your listing
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="text-green-500 font-bold">✓</span> Update business description
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="text-green-500 font-bold">✓</span> Add phone number
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="text-green-500 font-bold">✓</span> 1 photo upload
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="text-green-500 font-bold">✓</span> Dog feature highlights
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="text-green-500 font-bold">✓</span> View customer reviews
                </li>
              </ul>
              <Link
                href="/login?redirect=/business/claim"
                className="block w-full py-3 text-center bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Premium Plan */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                POPULAR
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">Premium</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$29</span>
                  <span className="opacity-80">/month</span>
                </div>
                <p className="text-sm opacity-80 mt-2">For businesses ready to grow</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> Everything in Free, plus:
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> Up to 10 photos
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> Featured placement in search
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> Verified &amp; Premium badges
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> Respond to reviews
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> 30-day analytics &amp; click tracking
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> Website link &amp; opening hours
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-bold">✓</span> Priority support
                </li>
              </ul>
              <Link
                href="/login?redirect=/business/upgrade"
                className="block w-full py-3 text-center bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors"
              >
                Start Premium
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-bold text-gray-900 mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold text-gray-900 mb-2">Is it really free to get started?</h3>
              <p className="text-gray-600">Yes! You can claim and manage your listing completely free. The Premium plan adds advanced features like analytics, additional photos, and featured placement.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold text-gray-900 mb-2">How long does the claim process take?</h3>
              <p className="text-gray-600">We typically review and approve claims within 1-2 business days. You&apos;ll receive an email notification once your claim is processed.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold text-gray-900 mb-2">What if my business isn&apos;t listed yet?</h3>
              <p className="text-gray-600">We&apos;re constantly adding new dog-friendly establishments. If yours isn&apos;t listed, contact us and we&apos;ll get it added right away.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-bold text-gray-900 mb-2">Can I cancel my Premium subscription anytime?</h3>
              <p className="text-gray-600">Absolutely. You can downgrade to Free at any time. Your listing will remain active — you&apos;ll just lose access to the premium features.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-orange-600 to-amber-500 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
            Ready to Reach More Dog Owners?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-xl mx-auto">
            Join hundreds of dog-friendly businesses already growing with Paw Cities.
          </p>
          <Link
            href="/login?redirect=/business/claim"
            className="inline-block px-10 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-colors shadow-lg"
          >
            Claim Your Business Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-white">Paw Cities</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/explore" className="hover:text-white transition-colors">Explore</Link>
              <Link href="/for-business" className="hover:text-white transition-colors">For Business</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-gray-500">&copy; 2026 Paw Cities. Made with love for dogs and their humans.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

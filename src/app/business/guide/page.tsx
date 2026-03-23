'use client';

import { useState } from 'react';
import Link from 'next/link';

type Section = 'overview' | 'claim' | 'listing' | 'photos' | 'reviews' | 'analytics' | 'upgrade';

const sections: { id: Section; title: string; icon: string }[] = [
  { id: 'overview', title: 'Dashboard Overview', icon: '📊' },
  { id: 'claim', title: 'Claiming Your Business', icon: '🏢' },
  { id: 'listing', title: 'Editing Your Listing', icon: '✏️' },
  { id: 'photos', title: 'Managing Photos', icon: '📸' },
  { id: 'reviews', title: 'Reviews', icon: '⭐' },
  { id: 'analytics', title: 'Analytics & Insights', icon: '📈' },
  { id: 'upgrade', title: 'Free vs Premium', icon: '👑' },
];

function TierTag({ tier }: { tier: 'free' | 'premium' }) {
  return tier === 'free' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">Free</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Premium</span>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-bold">{number}</div>
      <div className="flex-1">
        <p className="font-medium text-gray-900 mb-1">{title}</p>
        <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function FeatureRow({ label, free, premium }: { label: string; free: string | boolean; premium: string | boolean }) {
  const renderCell = (val: string | boolean) => {
    if (val === true) return <span className="text-green-600">&#10003;</span>;
    if (val === false) return <span className="text-gray-300">&mdash;</span>;
    return <span className="text-sm text-gray-700">{val}</span>;
  };
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2.5 pr-4 text-sm text-gray-900">{label}</td>
      <td className="py-2.5 px-4 text-center">{renderCell(free)}</td>
      <td className="py-2.5 px-4 text-center">{renderCell(premium)}</td>
    </tr>
  );
}

export default function BusinessGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Business Owner Guide</h1>
        <p className="text-gray-600">Everything you need to know about managing your business on Paw Cities. Select a topic below to learn more.</p>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b pb-4">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === s.id
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{s.icon}</span>
            <span className="hidden sm:inline">{s.title}</span>
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-xl border p-6 sm:p-8">
        {/* ===== DASHBOARD OVERVIEW ===== */}
        {activeSection === 'overview' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Dashboard Overview</h2>
            <p className="text-gray-600 mb-6">
              Your dashboard is your home base for managing your business listing on Paw Cities. Here&apos;s what you&apos;ll find when you log in.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Stats at a Glance</h3>
                <p className="text-sm text-gray-600 mb-3">The top of your dashboard shows four key metrics:</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Profile Views', desc: 'How many people viewed your listing page' },
                    { label: 'Check-ins', desc: 'Visitors who checked in at your location' },
                    { label: 'Reviews', desc: 'Total reviews and your average star rating' },
                    { label: 'Favorites', desc: 'People who saved your business to their favorites' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{stat.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{stat.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Quick Actions</h3>
                <p className="text-sm text-gray-600 mb-3">Shortcuts to the most common tasks. Some actions require a Premium plan:</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2"><TierTag tier="free" /> <span><strong>Edit Listing</strong> &mdash; Update your description, phone, website, and dog-friendly features</span></li>
                  <li className="flex items-start gap-2"><TierTag tier="premium" /> <span><strong>Respond to Reviews</strong> &mdash; Reply publicly to customer reviews</span></li>
                  <li className="flex items-start gap-2"><TierTag tier="premium" /> <span><strong>Create Event</strong> &mdash; Promote upcoming events at your venue</span></li>
                  <li className="flex items-start gap-2"><TierTag tier="premium" /> <span><strong>Special Offers</strong> &mdash; Create promotions to attract more visitors</span></li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Activity Summary</h3>
                <p className="text-sm text-gray-600">Shows a real-time summary of your reviews, check-ins, and favorites. When there&apos;s no activity yet, you&apos;ll see a prompt to start engaging with your listing.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Listing Completeness</h3>
                <p className="text-sm text-gray-600">A progress tracker in the sidebar shows how complete your listing is. A complete listing helps you rank higher in search and builds trust with visitors. It checks whether you&apos;ve added your name and address, category, description, photos, business hours, phone number, and website.</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Tip:</strong> Complete your listing to 100% to maximize your visibility in search results. Businesses with full profiles get up to 3x more engagement.
              </p>
            </div>
          </div>
        )}

        {/* ===== CLAIMING YOUR BUSINESS ===== */}
        {activeSection === 'claim' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Claiming Your Business</h2>
            <p className="text-gray-600 mb-6">
              If your business is already listed on Paw Cities, you can claim it to take control of the listing. If it&apos;s not listed yet, you can add it.
            </p>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">How to Claim an Existing Listing</h3>
              <div className="space-y-1">
                <Step number={1} title="Search for your business">
                  Go to <Link href="/business/claim" className="text-orange-600 hover:underline">Claim Your Business</Link> and type your business name. We&apos;ll show matching listings from our directory.
                </Step>
                <Step number={2} title="Select your business">
                  Click on the correct listing from the search results. Make sure the address matches your location.
                </Step>
                <Step number={3} title="Fill in verification details">
                  Provide your contact name, email, and phone number. Select a verification method (such as business license). For fastest approval, use an email address that matches your business website domain.
                </Step>
                <Step number={4} title="Wait for approval">
                  Our team reviews claims within 1&ndash;2 business days. You&apos;ll receive an email once your claim is approved.
                </Step>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Adding a New Business</h3>
              <p className="text-sm text-gray-600 mb-3">If your business doesn&apos;t appear in search results, click &ldquo;Add a New Business&rdquo; on the claim page. You&apos;ll need to provide:</p>
              <ul className="space-y-1.5 text-sm text-gray-700">
                <li>&bull; Business name and full address</li>
                <li>&bull; City and category (e.g., Restaurant, Dog Park, Veterinarian)</li>
                <li>&bull; Description, phone, and website (optional but recommended)</li>
                <li>&bull; Dog-friendly features your venue offers</li>
                <li>&bull; Your contact information for verification</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Each business can only have one verified owner. If someone has already claimed your business, contact our support team for a transfer.
              </p>
            </div>
          </div>
        )}

        {/* ===== EDITING YOUR LISTING ===== */}
        {activeSection === 'listing' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Editing Your Listing</h2>
            <p className="text-gray-600 mb-6">
              Keep your listing accurate and compelling to attract more dog-owning visitors. Go to <Link href="/business/listing" className="text-orange-600 hover:underline">Edit Listing</Link> from your dashboard.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description <TierTag tier="free" /></h3>
                <p className="text-sm text-gray-600">Write a compelling description of your business (up to 500 characters). Mention what makes your venue special for dog owners&mdash;outdoor seating, treats at the counter, water bowls, etc.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Contact Info <TierTag tier="free" /></h3>
                <p className="text-sm text-gray-600">Add your phone number and website URL. Your website link becomes clickable on your public listing with a Premium plan.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Dog-Friendly Features <TierTag tier="free" /></h3>
                <p className="text-sm text-gray-600 mb-2">Toggle the amenities your venue offers. These appear as badges on your listing and help dog owners find you:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Water Bowl', 'Treats', 'Outdoor Seating', 'Dogs Inside', 'Off-Leash Area', 'Dog Menu', 'Fenced', 'Shade'].map((f) => (
                    <div key={f} className="bg-gray-50 rounded px-3 py-2 text-xs text-gray-700 text-center">{f}</div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Business Hours <TierTag tier="premium" /></h3>
                <p className="text-sm text-gray-600">Set your opening and closing times for each day of the week. This helps visitors know when to stop by. Available with a Premium plan.</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Tip:</strong> After making changes, click &ldquo;Save Changes&rdquo; at the bottom of the page. You&apos;ll see a confirmation once your updates are saved.
              </p>
            </div>
          </div>
        )}

        {/* ===== MANAGING PHOTOS ===== */}
        {activeSection === 'photos' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Managing Photos</h2>
            <p className="text-gray-600 mb-6">
              Great photos make your listing stand out. Manage your photos from the <Link href="/business/photos" className="text-orange-600 hover:underline">Photos</Link> page.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Photo Limits</h3>
                <div className="flex gap-4">
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">1</p>
                    <p className="text-xs text-gray-500">Free Plan</p>
                  </div>
                  <div className="flex-1 bg-amber-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-amber-800">10</p>
                    <p className="text-xs text-amber-700">Premium Plan</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">How to Upload</h3>
                <div className="space-y-1">
                  <Step number={1} title="Go to the Photos page">
                    Click &ldquo;Photos&rdquo; in the sidebar navigation.
                  </Step>
                  <Step number={2} title="Click Upload or drag a file">
                    Select a photo from your device. Accepted formats: JPG, PNG, WebP. Maximum size: 5MB. Minimum dimensions: 800&times;600 pixels.
                  </Step>
                  <Step number={3} title="Wait for approval">
                    Photos go through a brief review (1&ndash;2 business days) before appearing on your listing. You&apos;ll see status labels: Pending Review, Approved, or Rejected.
                  </Step>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Import from Google</h3>
                <p className="text-sm text-gray-600">If your business has a Google Business Profile, we can automatically import your photos. Click &ldquo;Import from Google&rdquo; on the Photos page. You can refresh imported photos at any time.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Deleting Photos</h3>
                <p className="text-sm text-gray-600">Click the delete icon on any photo to remove it. You&apos;ll be asked to confirm before the photo is deleted.</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Tip:</strong> Use bright, well-lit photos that show dogs welcome at your venue. Listings with photos receive significantly more engagement than those without.
              </p>
            </div>
          </div>
        )}

        {/* ===== REVIEWS ===== */}
        {activeSection === 'reviews' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reviews</h2>
            <p className="text-gray-600 mb-6">
              Reviews are one of the most important factors for attracting new visitors. Manage them from the <Link href="/business/reviews" className="text-orange-600 hover:underline">Reviews</Link> page.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Viewing Reviews <TierTag tier="free" /></h3>
                <p className="text-sm text-gray-600">All business owners can see their reviews, including star ratings, review text, and the reviewer&apos;s name. At the top of the page, you&apos;ll find summary cards showing your total reviews, average rating, and response rate.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Responding to Reviews <TierTag tier="premium" /></h3>
                <p className="text-sm text-gray-600 mb-3">Premium members can publicly respond to any review. Your response appears directly below the customer&apos;s review on your listing.</p>
                <div className="space-y-1">
                  <Step number={1} title="Find the review you want to respond to">
                    Scroll through your reviews on the Reviews page.
                  </Step>
                  <Step number={2} title="Write your response">
                    Click the response field below the review and type your reply. Be professional, thank the reviewer, and address any specific feedback.
                  </Step>
                  <Step number={3} title="Submit">
                    Click &ldquo;Submit Response&rdquo; to publish your reply. It will be visible to everyone who views the review.
                  </Step>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Tip:</strong> Responding to reviews (both positive and constructive) shows potential visitors that you care about your customers. Businesses that respond to reviews see higher engagement rates.
              </p>
            </div>
          </div>
        )}

        {/* ===== ANALYTICS ===== */}
        {activeSection === 'analytics' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Analytics & Insights</h2>
            <p className="text-gray-600 mb-6">
              Track how your listing is performing. Visit the <Link href="/business/analytics" className="text-orange-600 hover:underline">Analytics</Link> page to see your data.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Free Plan Analytics <TierTag tier="free" /></h3>
                <p className="text-sm text-gray-600 mb-3">All business owners get access to three key aggregate metrics:</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Search Appearances', desc: 'Times your listing appeared in search' },
                    { label: 'Total Clicks', desc: 'Clicks on your listing from search results' },
                    { label: 'Click-Through Rate', desc: 'Percentage of appearances that resulted in clicks' },
                  ].map((m) => (
                    <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-900">{m.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Premium Analytics <TierTag tier="premium" /></h3>
                <p className="text-sm text-gray-600 mb-3">Unlock the full analytics dashboard with Premium:</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li><strong>Date Range Selection</strong> &mdash; View data for 7, 30, 60, or 90 days, or set custom date ranges</li>
                  <li><strong>Click Breakdown</strong> &mdash; See which actions visitors take: phone calls, website visits, or direction requests</li>
                  <li><strong>Views & Clicks Trend</strong> &mdash; Visual chart showing your traffic over time</li>
                  <li><strong>Unique Visitors</strong> &mdash; Count of distinct visitors to your listing</li>
                  <li><strong>Peak Day Analysis</strong> &mdash; Identify your busiest day of the week</li>
                  <li><strong>Recent Activity Feed</strong> &mdash; Real-time log of visitor interactions</li>
                  <li><strong>Daily Details Table</strong> &mdash; Sortable table with day-by-day breakdowns</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Exporting Data <TierTag tier="premium" /></h3>
                <p className="text-sm text-gray-600">Premium members can export analytics as CSV files. Two export options are available: Daily Metrics (aggregated by day) and Event Details (individual interaction records). Use these exports for your own reporting or to share with stakeholders.</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== FREE VS PREMIUM ===== */}
        {activeSection === 'upgrade' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Free vs Premium Plans</h2>
            <p className="text-gray-600 mb-6">
              Paw Cities offers a generous free plan for all businesses. Upgrade to Premium to unlock powerful tools for growth.
            </p>

            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <div className="flex-1 border rounded-xl p-5 text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Free</p>
                  <p className="text-3xl font-bold text-gray-900">$0</p>
                  <p className="text-xs text-gray-500">forever</p>
                </div>
                <div className="flex-1 border-2 border-orange-300 bg-orange-50 rounded-xl p-5 text-center">
                  <p className="text-sm font-medium text-orange-700 mb-1">Premium</p>
                  <p className="text-3xl font-bold text-orange-800">$29</p>
                  <p className="text-xs text-orange-600">/month or $249/year (save $99)</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2">
                    <th className="pb-3 text-sm font-semibold text-gray-900 pr-4">Feature</th>
                    <th className="pb-3 text-sm font-semibold text-gray-500 px-4 text-center">Free</th>
                    <th className="pb-3 text-sm font-semibold text-orange-700 px-4 text-center">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={3} className="pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Listing</td></tr>
                  <FeatureRow label="Basic listing" free={true} premium={true} />
                  <FeatureRow label="Enhanced description" free={false} premium={true} />
                  <FeatureRow label="Clickable website link" free={false} premium={true} />
                  <FeatureRow label="Business hours display" free={false} premium={true} />

                  <tr><td colSpan={3} className="pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Photos</td></tr>
                  <FeatureRow label="Photo uploads" free="1 photo" premium="Up to 10" />
                  <FeatureRow label="Featured placement" free={false} premium={true} />

                  <tr><td colSpan={3} className="pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Visibility</td></tr>
                  <FeatureRow label="Search results" free={true} premium={true} />
                  <FeatureRow label="Priority in search" free={false} premium={true} />
                  <FeatureRow label="Verified badge" free={false} premium={true} />
                  <FeatureRow label="Premium badge" free={false} premium={true} />

                  <tr><td colSpan={3} className="pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Engagement</td></tr>
                  <FeatureRow label="View reviews" free={true} premium={true} />
                  <FeatureRow label="Respond to reviews" free={false} premium={true} />
                  <FeatureRow label="Events & offers" free={false} premium={true} />

                  <tr><td colSpan={3} className="pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Analytics</td></tr>
                  <FeatureRow label="Aggregate stats" free={true} premium={true} />
                  <FeatureRow label="Date range selection" free={false} premium={true} />
                  <FeatureRow label="Click breakdown by type" free={false} premium={true} />
                  <FeatureRow label="Trend charts" free={false} premium={true} />
                  <FeatureRow label="CSV export" free={false} premium={true} />
                  <FeatureRow label="Weekly reports" free={false} premium={true} />
                </tbody>
              </table>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/business/upgrade"
                className="inline-flex px-6 py-2.5 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
              >
                View Plans & Upgrade
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Help Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Need help? Have a feature suggestion? Reach us at <a href="mailto:support@pawcities.com" className="text-orange-600 hover:underline">support@pawcities.com</a></p>
      </div>
    </div>
  );
}

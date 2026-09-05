import Link from 'next/link';

export const metadata = {
  title: 'About Paw Cities',
  description:
    'Paw Cities helps dog owners discover dog-friendly places, events, and community across 9 cities worldwide, with hundreds of hand-verified establishments.',
};

const CITIES = [
  'Atlanta',
  'Barcelona',
  'Geneva',
  'London',
  'Los Angeles',
  'New York City',
  'Paris',
  'Sydney',
  'Tokyo',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold mb-4">
            About Paw Cities
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            The guide to dog-friendly places, events, and community — built by
            dog lovers, for dog lovers.
          </p>
        </div>
      </section>

      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        {/* What we do */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">What We Do</h2>
          <p className="text-gray-600 mb-4">
            Paw Cities helps dog owners discover dog-friendly places, events,
            and community in 9 cities around the world:
          </p>
          <ul className="flex flex-wrap gap-2 mb-4">
            {CITIES.map((city) => (
              <li
                key={city}
                className="px-3 py-1 bg-orange-50 text-orange-800 rounded-full text-sm font-medium"
              >
                {city}
              </li>
            ))}
          </ul>
          <p className="text-gray-600">
            Our guide covers roughly 600 hand-verified dog-friendly
            establishments — parks, restaurants, cafes, hotels, beaches, vets,
            groomers, and shops — each with the dog-specific details that
            actually matter: water bowls, off-leash areas, dog menus, and
            patios.
          </p>
        </section>

        {/* Events */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Events, Verified Daily
          </h2>
          <p className="text-gray-600">
            Our live events calendar is verified every day, so when you show up
            to a pup-friendly market, meetup, or yappy hour, it&apos;s actually
            happening.
          </p>
        </section>

        {/* Community */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            A Community, Not Just a Directory
          </h2>
          <p className="text-gray-600 mb-4">
            Create a free profile for your dog, check in at your favorite
            spots, write reviews, save favorites, follow other dogs, and form
            packs — our word for dog friendships. It&apos;s all free.
          </p>
          <p className="text-gray-600">
            On the ground in every city, our{' '}
            <Link
              href="/ambassadors"
              className="text-orange-700 font-semibold underline hover:text-orange-800"
            >
              City Ambassadors
            </Link>{' '}
            sniff out new places, keep listings honest, and welcome new members
            to the pack.
          </p>
        </section>

        {/* Mascots */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Meet Marley &amp; Buster
          </h2>
          <p className="text-gray-600 mb-4">
            Two dogs guide everything we make.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Marley</h3>
              <p className="text-sm text-gray-600">
                A cream-white cockapoo in a navy bandana. The thoughtful one —
                he reads the reviews twice before picking a patio.
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Buster</h3>
              <p className="text-sm text-gray-600">
                A golden-honey mixed breed in an olive-green collar. The
                adventurer — first to the beach, first in the water.
              </p>
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            From the Founder
          </h2>
          <p className="text-gray-600">
            Paw Cities was founded by Eric Silverstein, a dog lover who kept
            wishing a guide like this existed — so he built it. Every listing,
            event, and feature starts with the same question: would this make a
            day out with your dog better?
          </p>
        </section>

        {/* Contact */}
        <section className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
          <h2 className="font-semibold text-gray-900 mb-2">Get in Touch</h2>
          <p className="text-sm text-gray-600">
            Email us at{' '}
            <a
              href="mailto:eric@pawcities.com"
              className="text-orange-700 font-semibold underline hover:text-orange-800"
            >
              eric@pawcities.com
            </a>{' '}
            or follow{' '}
            <a
              href="https://www.instagram.com/thepawcities"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-700 font-semibold underline hover:text-orange-800"
            >
              @thepawcities
            </a>{' '}
            on Instagram.
          </p>
        </section>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StripDog {
  id: string;
  slug: string;
  name: string;
  breed: string | null;
  photo: string | null;
}

interface ActivityItem {
  id: string;
  type: string;
  createdAt: string;
  userName: string;
  establishment: { slug: string; name: string; citySlug: string } | null;
  rating: number | null;
  dog: { slug: string; name: string; photo: string | null } | null;
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function CityCommunityStrip({
  citySlug,
  cityName,
}: {
  citySlug: string;
  cityName: string;
}) {
  const [dogs, setDogs] = useState<StripDog[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/community/dogs?city=${citySlug}&limit=4`).then(r => r.json()).catch(() => ({ dogs: [] })),
      fetch(`/api/community/activity?city=${citySlug}&limit=6`).then(r => r.json()).catch(() => ({ items: [] })),
    ])
      .then(([dogData, actData]) => {
        setDogs(dogData.dogs || []);
        setActivity(actData.items || []);
      })
      .finally(() => setLoaded(true));
  }, [citySlug]);

  if (!loaded) return null;

  return (
    <section className="bg-orange-50/60 border-t py-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl md:text-2xl font-bold">
            🐾 The {cityName} Pack
          </h2>
          <Link href={`/dogs?city=${citySlug}`} className="text-sm font-medium text-orange-600 hover:underline">
            See all dogs →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Local dogs */}
          <div>
            {dogs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-orange-100 p-6 text-center h-full flex flex-col items-center justify-center">
                <span className="text-4xl block mb-2">🐶</span>
                <p className="font-semibold text-gray-900 mb-1">
                  Be the first dog on the {cityName} map
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Create a free profile for your pup and start the local pack.
                </p>
                <Link
                  href="/profile/dogs/new"
                  className="px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Add your dog
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {dogs.map(dog => (
                  <Link
                    key={dog.id}
                    href={`/dogs/${dog.slug}`}
                    className="bg-white rounded-2xl border border-orange-100 overflow-hidden hover:shadow-md hover:border-orange-300 transition-all"
                  >
                    <div className="aspect-square bg-orange-100">
                      {dog.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dog.photo} alt={dog.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🐶</div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="font-semibold text-sm text-gray-900 truncate">{dog.name}</p>
                      <p className="text-xs text-gray-500 truncate">{dog.breed || 'Mixed breed'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-orange-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Recent activity in {cityName}</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-gray-500">
                No check-ins yet — sign in, visit a spot, and be the first to check in! 📍
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.map(item => (
                  <li key={item.id} className="text-sm text-gray-600 flex items-baseline gap-2">
                    <span className="shrink-0">{item.type === 'check_in' ? '📍' : '⭐'}</span>
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{item.userName}</span>{' '}
                      {item.type === 'check_in' ? 'checked in at' : 'reviewed'}{' '}
                      {item.establishment ? (
                        <Link
                          href={`/${item.establishment.citySlug}/${item.establishment.slug}`}
                          className="font-medium text-orange-600 hover:underline"
                        >
                          {item.establishment.name}
                        </Link>
                      ) : (
                        'a spot'
                      )}
                      {item.dog && (
                        <>
                          {' '}with{' '}
                          <Link href={`/dogs/${item.dog.slug}`} className="font-medium text-orange-600 hover:underline">
                            {item.dog.name}
                          </Link>
                        </>
                      )}
                      {item.rating ? <span className="text-amber-500"> {'★'.repeat(item.rating)}</span> : null}
                      <span className="text-gray-400 text-xs"> · {timeAgo(item.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

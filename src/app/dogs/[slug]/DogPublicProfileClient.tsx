'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButtons } from '@/components/community/ConnectButtons';

interface DogProfile {
  dog: {
    id: string;
    slug: string;
    name: string;
    breed: string | null;
    birthDate: string | null;
    size: string | null;
    personality: string | null;
    bio: string | null;
    photo: string | null;
    photos: string[];
    createdAt: string;
  };
  owner: {
    id: string;
    name: string | null;
    avatar: string | null;
    memberSince: string;
    city: { slug: string; name: string } | null;
    followers: number;
    following: number;
    otherDogs: {
      id: string;
      slug: string;
      name: string;
      breed: string | null;
      photo: string | null;
    }[];
  };
  viewer: {
    isAuthenticated: boolean;
    isOwnDog: boolean;
    isFollowing: boolean;
    packStatus: string | null;
  };
}

const SIZE_LABELS: Record<string, string> = {
  TINY: 'Tiny',
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
  XLARGE: 'Extra Large',
  GIANT: 'Giant',
};

function dogAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years > 0) return `${years} year${years !== 1 ? 's' : ''} old`;
  if (months > 0) return `${months} month${months !== 1 ? 's' : ''} old`;
  return 'Puppy';
}

export function DogPublicProfileClient({ slug }: { slug: string }) {
  const [data, setData] = useState<DogProfile | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/community/dogs/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl block mb-4">🐕</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            This pup isn&apos;t public (or doesn&apos;t exist)
          </h1>
          <Link href="/dogs" className="text-orange-600 hover:underline">
            ← Back to the community
          </Link>
        </div>
      </div>
    );
  }

  const { dog, owner, viewer } = data;
  const photos = dog.photos.length > 0 ? dog.photos : dog.photo ? [dog.photo] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dogs" className="text-sm text-gray-500 hover:text-orange-600 transition-colors">
          ← All dogs
        </Link>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Photos */}
          <div className="lg:col-span-2">
            <div className="aspect-square bg-orange-50 rounded-2xl overflow-hidden border border-gray-200">
              {photos.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photos[activePhoto]}
                  alt={dog.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">🐶</div>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 mt-3">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === activePhoto ? 'border-orange-500' : 'border-transparent'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{dog.name}</h1>
                  <p className="text-gray-500 mt-1">
                    {dog.breed || 'Mixed breed'}
                    {dogAge(dog.birthDate) ? ` · ${dogAge(dog.birthDate)}` : ''}
                    {dog.size && SIZE_LABELS[dog.size] ? ` · ${SIZE_LABELS[dog.size]}` : ''}
                  </p>
                  {owner.city && (
                    <Link
                      href={`/${owner.city.slug}`}
                      className="inline-block mt-2 text-sm text-orange-600 hover:underline"
                    >
                      📍 {owner.city.name}
                    </Link>
                  )}
                </div>
                {viewer.isOwnDog ? (
                  <Link
                    href={`/profile/dogs/${dog.id}`}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit profile
                  </Link>
                ) : (
                  <ConnectButtons
                    ownerId={owner.id}
                    isAuthenticated={viewer.isAuthenticated}
                    initialFollowing={viewer.isFollowing}
                    initialPackStatus={viewer.packStatus}
                  />
                )}
              </div>

              {(dog.bio || dog.personality) && (
                <div className="mt-6">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
                    About {dog.name}
                  </h2>
                  <p className="text-gray-600 whitespace-pre-line">
                    {dog.bio || dog.personality}
                  </p>
                </div>
              )}

              {/* Owner card */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  {owner.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={owner.avatar}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center font-semibold text-orange-600">
                      {(owner.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{owner.name || 'Dog lover'}</p>
                    <p className="text-xs text-gray-500">
                      {owner.followers} follower{owner.followers !== 1 ? 's' : ''} · Member
                      since{' '}
                      {new Date(owner.memberSince).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Other dogs */}
            {owner.otherDogs.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  More from this family
                </h2>
                <div className="flex gap-3 flex-wrap">
                  {owner.otherDogs.map((o) => (
                    <Link
                      key={o.id}
                      href={`/dogs/${o.slug}`}
                      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors"
                    >
                      {o.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.photo}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                          🐶
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{o.name}</p>
                        <p className="text-xs text-gray-500">{o.breed || 'Mixed breed'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

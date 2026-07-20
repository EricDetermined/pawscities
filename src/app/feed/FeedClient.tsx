'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface FeedItem {
  id: string;
  type: string;
  createdAt: string;
  user: { id: string; name: string | null; avatar: string | null } | null;
  establishment: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    city: { slug: string; name: string } | null;
  } | null;
  checkIn: {
    note: string | null;
    rating: number | null;
    photo: string | null;
    dog: { slug: string; name: string; photo: string | null } | null;
  } | null;
  review: { title: string | null; rating: number; content: string | null } | null;
}

interface PackEntry {
  linkId: string;
  user: { id: string; name: string | null; avatar: string | null };
  since: string;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Avatar({ user }: { user: { name: string | null; avatar: string | null } | null }) {
  if (user?.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />;
  }
  return (
    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-semibold text-orange-600">
      {(user?.name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(rating)}
      <span className="text-gray-200">{'★'.repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

export function FeedClient() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [incoming, setIncoming] = useState<PackEntry[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feedRes, packRes] = await Promise.all([
        fetch('/api/community/feed'),
        fetch('/api/community/pack'),
      ]);
      if (feedRes.status === 401) {
        setAuthed(false);
        return;
      }
      const feed = await feedRes.json();
      setItems(feed.items || []);
      setFollowingCount(feed.followingCount || 0);
      if (packRes.ok) {
        const pack = await packRes.json();
        setIncoming(pack.incoming || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (linkId: string, action: 'accept' | 'decline') => {
    await fetch('/api/community/pack', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: linkId, action }),
    });
    setIncoming(prev => prev.filter(r => r.linkId !== linkId));
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl block mb-4">🐾</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to see your feed</h1>
          <p className="text-gray-500 mb-6">
            Follow dog owners around your city and their check-ins show up here.
          </p>
          <Link
            href="/login?redirect=/feed"
            className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
          <Link href="/dogs" className="text-sm text-orange-600 hover:underline">
            Find dogs to follow →
          </Link>
        </div>

        {/* Incoming pack requests */}
        {incoming.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-orange-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Pack requests ({incoming.length})
            </h2>
            <div className="space-y-3">
              {incoming.map((req) => (
                <div key={req.linkId} className="flex items-center gap-3">
                  <Avatar user={req.user} />
                  <p className="flex-1 text-sm text-gray-700">
                    <span className="font-medium">{req.user.name || 'A dog owner'}</span> wants
                    to join packs with you
                  </p>
                  <button
                    onClick={() => respond(req.linkId, 'accept')}
                    className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(req.linkId, 'decline')}
                    className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50"
                  >
                    Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500">
            Loading your feed...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <span className="text-5xl block mb-4">🦴</span>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {followingCount === 0 ? 'Your feed is waiting' : 'Nothing new yet'}
            </h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {followingCount === 0
                ? 'Follow dog owners in your city and their check-ins and reviews will show up here.'
                : 'The people you follow haven’t checked in anywhere recently.'}
            </p>
            <Link
              href="/dogs"
              className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              Browse the community
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-3">
                  <Avatar user={item.user} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">{item.user?.name || 'Someone'}</span>{' '}
                      {item.type === 'check_in' ? 'checked in at' : 'reviewed'}{' '}
                      {item.establishment ? (
                        <Link
                          href={`/${item.establishment.city?.slug || ''}/${item.establishment.slug}`}
                          className="font-semibold text-orange-600 hover:underline"
                        >
                          {item.establishment.name}
                        </Link>
                      ) : (
                        'a place'
                      )}
                      {item.checkIn?.dog && (
                        <>
                          {' '}with{' '}
                          <Link
                            href={`/dogs/${item.checkIn.dog.slug}`}
                            className="font-semibold text-orange-600 hover:underline"
                          >
                            {item.checkIn.dog.name}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.establishment?.city ? `${item.establishment.city.name} · ` : ''}
                      {timeAgo(item.createdAt)}
                    </p>
                  </div>
                </div>

                {(item.checkIn?.rating || item.review?.rating) && (
                  <div className="mt-3">
                    <Stars rating={(item.checkIn?.rating || item.review?.rating) as number} />
                  </div>
                )}

                {item.review?.title && (
                  <p className="mt-2 font-medium text-gray-900 text-sm">{item.review.title}</p>
                )}
                {(item.checkIn?.note || item.review?.content) && (
                  <p className="mt-1 text-sm text-gray-600">
                    {item.checkIn?.note || item.review?.content}
                  </p>
                )}

                {item.checkIn?.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.checkIn.photo}
                    alt=""
                    className="mt-3 rounded-xl max-h-80 w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

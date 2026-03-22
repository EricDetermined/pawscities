'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  dog_friendliness: number | null;
  created_at: string;
  establishment_id: string;
  establishments: {
    name: string;
    slug: string;
    city_id: string;
    primary_image: string | null;
  } | null;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data.user?.id) {
          return fetch(`/api/reviews?userId=${data.user.id}`);
        }
        throw new Error('Not authenticated');
      })
      .then(res => res.json())
      .then(data => setReviews(data.reviews || []))
      .catch(() => setError('Failed to load reviews'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading reviews...</div></div>;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-500' : 'text-gray-300'}>&#9733;</span>
    ));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Reviews</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">&#11088;</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No reviews yet</h2>
          <p className="text-gray-500">Visit a dog-friendly place and share your experience to help other dog owners.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => {
            const est = review.establishments;
            return (
              <div key={review.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Business header */}
                {est && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0 overflow-hidden">
                      {est.primary_image ? (
                        <img src={est.primary_image} alt={est.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">&#128205;</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{est.name}</p>
                      <p className="text-xs text-gray-500">You reviewed this place</p>
                    </div>
                    <Link
                      href={`/profile/favorites`}
                      className="text-xs text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 whitespace-nowrap"
                    >
                      &#10084;&#65039; Save
                    </Link>
                  </div>
                )}

                {/* Review content */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex text-sm">{renderStars(review.rating)}</div>
                    <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                  {review.title && <h3 className="font-semibold text-gray-900 mb-1">{review.title}</h3>}
                  {review.content && <p className="text-sm text-gray-600">{review.content}</p>}
                  {review.dog_friendliness && (
                    <div className="mt-3 flex items-center gap-1">
                      <span className="text-xs text-gray-500">Dog friendliness:</span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span key={i} className={`text-xs ${i < review.dog_friendliness! ? '' : 'opacity-30'}`}>&#128062;</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { TierBadge } from '@/components/business/TierBadge';

interface Review {
  id: string;
  rating: number;
  content: string;
  User?: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  businessResponse?: {
    id: string;
    response: string;
    respondedAt: string;
  } | null;
}

interface ReviewsData {
  reviews: Review[];
  summary: {
    totalReviews: number;
    avgRating: number;
    responseRate: string;
  };
}

interface Subscription {
  tier: 'free' | 'premium';
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? '⭐' : '☆'}>
          {' '}
        </span>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewsData | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const [reviewsRes, dashRes] = await Promise.all([
          fetch('/api/business/reviews'),
          fetch('/api/business/dashboard'),
        ]);

        if (!reviewsRes.ok || !dashRes.ok) {
          throw new Error('Failed to load reviews');
        }

        const reviewsData = await reviewsRes.json();
        const dashData = await dashRes.json();

        setReviews(reviewsData);
        setSubscription(dashData.subscription);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/business/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          response: responseText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit response');
      }

      // Update the review with the response
      if (reviews) {
        setReviews({
          ...reviews,
          reviews: reviews.reviews.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  businessResponse: await response.json(),
                }
              : r
          ),
        });
      }

      setRespondingTo(null);
      setResponseText('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!reviews || !subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Failed to load reviews
      </div>
    );
  }

  const tier = subscription.tier;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reviews</h1>
          <p className="text-gray-600">
            See what customers are saying about your business
          </p>
        </div>
        <TierBadge tier={tier} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Total Reviews</p>
          <p className="text-3xl font-bold text-gray-900">
            {reviews.summary.totalReviews}
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Average Rating</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-gray-900">
              {reviews.summary.avgRating.toFixed(1)}
            </p>
            <StarRating rating={Math.round(reviews.summary.avgRating)} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm mb-1">Response Rate</p>
          <p className="text-3xl font-bold text-gray-900">
            {reviews.summary.responseRate}%
          </p>
          {tier === 'free' && (
            <p className="text-xs text-gray-500 mt-2">
              Premium only
            </p>
          )}
        </div>
      </div>

      {/* Reviews List */}
      {reviews.reviews.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg">No reviews yet</p>
          <p className="text-gray-500 text-sm">
            Reviews from customers will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-lg p-6 border border-gray-200"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {review.User?.name || 'Anonymous'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Review Content */}
              <p className="text-gray-700 mb-4">{review.content}</p>

              {/* Business Response */}
              {review.businessResponse ? (
                <div className="bg-orange-50 rounded-lg p-4 mb-4 border border-orange-200">
                  <p className="text-sm font-semibold text-orange-900 mb-2">
                    Your Response
                  </p>
                  <p className="text-gray-700 text-sm">
                    {review.businessResponse.response}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Responded on{' '}
                    {new Date(
                      review.businessResponse.respondedAt
                    ).toLocaleDateString()}
                  </p>
                </div>
              ) : null}

              {/* Response Form */}
              {tier === 'premium' && !review.businessResponse ? (
                <>
                  {respondingTo === review.id ? (
                    <div className="space-y-3 pt-4 border-t border-gray-200">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Write your response..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-20"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSubmitResponse(review.id)}
                          disabled={submitting || !responseText.trim()}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:bg-gray-400"
                        >
                          {submitting ? 'Sending...' : 'Send Response'}
                        </button>
                        <button
                          onClick={() => {
                            setRespondingTo(null);
                            setResponseText('');
                          }}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRespondingTo(review.id)}
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Respond to Review
                    </button>
                  )}
                </>
              ) : null}

              {/* Premium Prompt for Free Tier */}
              {tier === 'free' && !review.businessResponse && (
                <div className="text-sm text-gray-600">
                  <p className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                    Premium feature - Upgrade to respond
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

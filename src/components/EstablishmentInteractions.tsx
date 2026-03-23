'use client';

import { useState, useEffect, useCallback } from 'react';
import AddReviewModal from '@/components/reviews/AddReviewModal';

interface Review {
  id: string;
  rating: number;
  title?: string;
  content?: string;
  dog_friendliness?: number;
  dog_names?: string;
  created_at: string;
  users?: { name?: string; avatar?: string };
}

interface EstablishmentInteractionsProps {
  establishmentId: string;
  establishmentName: string;
  establishmentSlug: string;
  citySlug: string;
  initialRating: number;
  initialReviewCount: number;
}

export default function EstablishmentInteractions({
  establishmentId,
  establishmentName,
  establishmentSlug,
  citySlug,
  initialRating,
  initialReviewCount,
}: EstablishmentInteractionsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptAction, setLoginPromptAction] = useState('');
  const [copied, setCopied] = useState(false);

  const loadReviews = useCallback(async () => {
    try {
      const res = await fetch(`/api/reviews?establishmentId=${establishmentId}&limit=10`);
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews || []);
        setReviewCount(data.pagination?.total || data.reviews?.length || 0);
      }
    } catch {
      // Keep showing whatever we have
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  // Check favorite status
  const checkFavorite = useCallback(async () => {
    try {
      const res = await fetch('/api/favorites');
      if (res.ok) {
        const data = await res.json();
        const favs = data.favorites || [];
        setIsFavorited(favs.some((f: Record<string, unknown>) => f.establishment_id === establishmentId));
      }
    } catch {
      // Not logged in or error - that's fine
    }
  }, [establishmentId]);

  useEffect(() => {
    loadReviews();
    checkFavorite();
  }, [loadReviews, checkFavorite]);

  const requireAuth = async (action: string, callback: () => void) => {
    // Try a quick auth check
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        callback();
        return;
      }
    } catch {}
    setLoginPromptAction(action);
    setShowLoginPrompt(true);
  };

  const handleWriteReview = () => {
    requireAuth('write a review', () => setShowReviewModal(true));
  };

  const handleToggleFavorite = () => {
    requireAuth('save favorites', async () => {
      setFavoriteLoading(true);
      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ establishmentId }),
        });
        if (res.ok) {
          const data = await res.json();
          setIsFavorited(data.favorited);
        }
      } catch {}
      setFavoriteLoading(false);
    });
  };

  const handleCheckIn = () => {
    requireAuth('check in', async () => {
      setCheckInLoading(true);
      try {
        const res = await fetch('/api/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ establishmentId }),
        });
        if (res.ok) {
          setCheckedIn(true);
          setTimeout(() => setCheckedIn(false), 3000);
        }
      } catch {}
      setCheckInLoading(false);
    });
  };

  const handleShare = (platform: string) => {
    const url = `${window.location.origin}/${citySlug}/${establishmentSlug}`;
    const text = `Check out ${establishmentName} on Paw Cities - a dog-friendly spot!`;

    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
        break;
      case 'copy':
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
        break;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'DL';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Action Buttons Row */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={handleWriteReview}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          Write a Review
        </button>
        <button
          onClick={handleToggleFavorite}
          disabled={favoriteLoading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            isFavorited
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <svg className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {isFavorited ? 'Saved' : 'Save'}
        </button>
        <button
          onClick={handleCheckIn}
          disabled={checkInLoading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            checkedIn
              ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {checkedIn ? 'Checked In!' : 'Check In'}
        </button>
      </div>

      {/* Reviews Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Paw Cities Reviews ({reviewCount})
          </h2>
          <button
            onClick={handleWriteReview}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            Write a Review
          </button>
        </div>

        {/* Rating Summary */}
        <div className="flex items-center gap-6 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">{initialRating.toFixed(1)}</div>
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`w-4 h-4 ${i < Math.round(initialRating) ? 'text-yellow-400 fill-current' : 'text-gray-300 fill-current'}`} viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-1">{reviewCount} reviews</div>
          </div>
        </div>

        {/* Review Cards */}
        {loading ? (
          <div className="py-8 text-center text-gray-400">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500 mb-3">No reviews yet. Be the first to share your experience!</p>
            <button
              onClick={handleWriteReview}
              className="px-6 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              Write the First Review
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm shrink-0">
                    {getInitials(review.users?.name)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{review.users?.name || 'Dog Lover'}</span>
                      <span className="text-gray-400 text-sm">{formatDate(review.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <svg key={j} className={`w-4 h-4 ${j < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300 fill-current'}`} viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                      {review.dog_names && (
                        <span className="ml-2 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                          {String.fromCodePoint(0x1F415)} with {review.dog_names}
                        </span>
                      )}
                      {review.dog_friendliness && (
                        <span className="ml-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          {String.fromCodePoint(0x1F43E)} {review.dog_friendliness}/5
                        </span>
                      )}
                    </div>
                    {review.title && (
                      <p className="font-medium text-gray-900 text-sm mb-1">{review.title}</p>
                    )}
                    {review.content && (
                      <p className="text-gray-700 text-sm leading-relaxed">{review.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold mb-3">Share this place</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleShare('facebook')}
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Facebook
          </button>
          <button
            onClick={() => handleShare('twitter')}
            className="flex-1 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
          >
            Twitter / X
          </button>
          <button
            onClick={() => handleShare('copy')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <AddReviewModal
          establishmentId={establishmentId}
          establishmentName={establishmentName}
          onClose={() => setShowReviewModal(false)}
          onReviewAdded={loadReviews}
        />
      )}

      {/* Login Prompt */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLoginPrompt(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">{String.fromCodePoint(0x1F43E)}</div>
            <h3 className="text-lg font-bold mb-2">Sign in to {loginPromptAction}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a free account to {loginPromptAction}, save favorites, and more.
            </p>
            <a
              href="/login"
              className="block w-full px-4 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors mb-2"
            >
              Sign In
            </a>
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="w-full px-4 py-2 text-gray-500 text-sm hover:text-gray-700"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </>
  );
}

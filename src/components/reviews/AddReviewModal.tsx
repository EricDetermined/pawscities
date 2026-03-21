'use client';

import { useState } from 'react';

interface AddReviewModalProps {
  establishmentId: string;
  establishmentName: string;
  onClose: () => void;
  onReviewAdded: () => void;
}

export default function AddReviewModal({ establishmentId, establishmentName, onClose, onReviewAdded }: AddReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dogFriendliness, setDogFriendliness] = useState(0);
  const [dogNames, setDogNames] = useState('');
  const [featuresExperienced, setFeaturesExperienced] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const DOG_FEATURES = [
    { key: 'waterBowl', label: 'Water Bowls', icon: '💧' },
    { key: 'treats', label: 'Dog Treats', icon: '🍖' },
    { key: 'outdoorSeating', label: 'Outdoor Seating', icon: '☀️' },
    { key: 'indoorAllowed', label: 'Dogs Inside', icon: '🏠' },
    { key: 'offLeashArea', label: 'Off-Leash', icon: '🐕' },
    { key: 'dogMenu', label: 'Dog Menu', icon: '🍽️' },
    { key: 'fenced', label: 'Fenced', icon: '🔒' },
    { key: 'shadeAvailable', label: 'Shade', icon: '🌳' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          rating,
          title: title || null,
          content: content || null,
          dogFriendliness: dogFriendliness || null,
          dogNames: dogNames || null,
          featuresExperienced: Object.keys(featuresExperienced).filter(k => featuresExperienced[k]),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit review');
        setSubmitting(false);
        return;
      }

      onReviewAdded();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-xl font-bold">Review {establishmentName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overall Rating *</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5"
                >
                  <svg
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoverRating || rating) ? 'text-yellow-400 fill-current' : 'text-gray-300 fill-current'
                    }`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Dog Friendliness */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dog Friendliness</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setDogFriendliness(star)}
                  className="p-0.5"
                >
                  <span className={`text-2xl ${star <= dogFriendliness ? '' : 'opacity-30'}`}>
                    {String.fromCodePoint(0x1F43E)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your experience"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              maxLength={255}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Review</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tell others about your experience with your dog..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Dog Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Dog&apos;s Name</label>
            <input
              type="text"
              value={dogNames}
              onChange={(e) => setDogNames(e.target.value)}
              placeholder="e.g., Luna, Rex"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Dog Features Experienced */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Which dog features did you experience?</label>
            <div className="grid grid-cols-2 gap-2">
              {DOG_FEATURES.map(feature => (
                <label
                  key={feature.key}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    featuresExperienced[feature.key]
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!featuresExperienced[feature.key]}
                    onChange={(e) => setFeaturesExperienced(prev => ({ ...prev, [feature.key]: e.target.checked }))}
                    className="sr-only"
                  />
                  <span>{feature.icon}</span>
                  <span>{feature.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

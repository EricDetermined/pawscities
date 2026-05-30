import type { Review } from '@/types';

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const filled = Math.round(review.rating);
  const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {review.userAvatar && (
            <img
              src={review.userAvatar}
              alt={review.userName}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <span className="font-medium">{review.userName}</span>
        </div>
        <span className="text-yellow-500 text-sm">{stars}</span>
      </div>

      <p className="text-gray-700 text-sm">{review.comment}</p>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Visited {new Date(review.visitDate).toLocaleDateString()}</span>
        <span>Dog-friendliness: {review.dogFriendlinessRating}/5</span>
      </div>

      {review.photos.length > 0 && (
        <div className="flex gap-2 mt-2">
          {review.photos.map((photo, i) => (
            <img
              key={i}
              src={photo}
              alt={`Review photo ${i + 1}`}
              className="w-16 h-16 rounded object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ReviewCard;

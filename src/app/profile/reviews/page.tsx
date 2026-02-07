import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { ReviewCard } from '@/components/reviews/ReviewCard';

export default async function MyReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/profile/reviews');
  }

  // Get user's reviews from database
  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: {
          establishment: {
            select: {
              name: true,
              slug: true,
              city: {
                select: { slug: true },
              },
            },
          },
        },
      },
    },
  });

  const reviews = dbUser?.reviews || [];

  // Calculate stats
  const totalReviews = reviews.length;
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  const totalHelpful = reviews.reduce((sum, r) => sum + r.helpfulCount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">⭐ My Reviews</h1>
          <p className="text-gray-600">Youhave written {totalReviews} reviews with an 
            average rating of {avgRating.toFixed(1)}/10 and {totalHelpful} 
            person found your review helpful.</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {reviews.map((review) => (
          <ReviewCard key={review.id} { ...review } />
        ))}
      </div>
  
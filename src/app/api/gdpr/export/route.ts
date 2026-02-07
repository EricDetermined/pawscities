import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

/**
 * GDPR Data Export Endpoint
 *
 * Allows authenticated users to export all their personal data in JSON format.
 * This includes: profile data, dog profiles, reviews, check-ins, and favorites.
 *
 * Request: GET /api/gdpr/export
 * Response: JSON file containing all user data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to export your data.' },
        { status: 401 }
      );
    }

    // Fetch user profile
    const userProfile = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        dogs: {
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            establishment: {
              select: {
                id: true,
                name: true,
                address: true,
                category: true,
              },
            },
          },
        },
        checkIns: {
          orderBy: { createdAt: 'desc' },
          include: {
            establishment: {
              select: {
                id: true,
                name: true,
                address: true,
                category: true,
              },
            },
          },
        },
        favorites: {
          orderBy: { createdAt: 'desc' },
          include: {
            establishment: {
              select: {
                id: true,
                name: true,
                address: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    // Build comprehensive export object
    const exportData = {
      exportDate: new Date().toISOString(),
      dataProtectionNotice: 'This is your personal data exported in compliance with GDPR Article 20 (Right to Data Portability).',

      profile: {
        id: userProfile.id,
        supabaseId: userProfile.supabaseId,
        email: userProfile.email,
        name: userProfile.name || null,
        createdAt: userProfile.createdAt,
        updatedAt: userProfile.updatedAt,
      },

      dogs: userProfile.dogs.map(dog => ({
        id: dog.id,
        name: dog.name,
        breed: dog.breed || null,
        birthDate: dog.birthDate || null,
        size: dog.size,
        personality: dog.personality || null,
        photo: dog.photo || null,
        createdAt: dog.createdAt,
        updatedAt: dog.updatedAt,
      })),

      reviews: userProfile.reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        title: review.title || null,
        content: review.content || null,
        helpful: review.helpful,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        establishment: {
          id: review.establishment.id,
          name: review.establishment.name,
          address: review.establishment.address,
          category: review.establishment.category,
        },
      })),

      checkIns: userProfile.checkIns.map(checkIn => ({
        id: checkIn.id,
        notes: checkIn.notes || null,
        createdAt: checkIn.createdAt,
        establishment: {
          id: checkIn.establishment.id,
          name: checkIn.establishment.name,
          address: checkIn.establishment.address,
          category: checkIn.establishment.category,
        },
      })),

      favorites: userProfile.favorites.map(favorite => ({
        id: favorite.id,
        createdAt: favorite.createdAt,
        establishment: {
          id: favorite.establishment.id,
          name: favorite.establishment.name,
          address: favorite.establishment.address,
          category: favorite.establishment.category,
        },
      })),

      summary: {
        totalDogs: userProfile.dogs.length,
        totalReviews: userProfile.reviews.length,
        totalCheckIns: userProfile.checkIns.length,
        totalFavorites: userProfile.favorites.length,
      },
    };

    // Create response with JSON file
    const jsonContent = JSON.stringify(exportData, null, 2);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `pawscities-data-export-${timestamp}.json`;

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('GDPR Data Export Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export data. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Security headers for all GDPR requests
 */
export const metadata = {
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  },
};

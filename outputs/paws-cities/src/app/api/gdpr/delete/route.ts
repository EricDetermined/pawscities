import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { deleteUserData } from '@/lib/gdpr';
import { checkRateLimitMiddleware } from '@/lib/security';
import { prisma } from '@/lib/db';

/**
 * GET /api/gdpr/delete
 * Check if account is deleted or active
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResponse = checkRateLimitMiddleware(request, 'api');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isDeleted = dbUser.email.startsWith('deleted-');

    return NextResponse.json({
      status: isDeleted ? 'deleted' : 'active',
      email: isDeleted ? '[redacted]' : dbUser.email,
      createdAt: dbUser.createdAt,
      message: isDeleted
        ? 'Your account has been deleted and data anonymized.'
        : 'Your account is active. To delete, send a POST request with confirmation.',
      gdprArticle: 'Article 17 - Right to Erasure',
    });
  } catch (error) {
    console.error('Error checking deletion status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check account status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gdpr/delete
 * Request account deletion and data erasure
 * Article 17 - Right to be Forgotten
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limiting (very strict for deletion)
    const rateLimitResponse = checkRateLimitMiddleware(request, 'gdpr');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { confirmation } = body;

    // Require explicit confirmation
    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return NextResponse.json(
        {
          error: 'Deletion not confirmed',
          message: 'To delete your account, please send a POST request with confirmation token: { "confirmation": "DELETE_MY_ACCOUNT" }',
          warning: 'This action is irreversible. All personal data will be permanently deleted.',
        },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user data (anonymize sensitive content)
    await deleteUserData(dbUser.id, { anonymize: true });

    // Delete from Supabase Auth as well
    try {
      await supabase.auth.admin.deleteUser(user.id);
    } catch (error) {
      console.warn('Failed to delete auth user:', error);
      // Continue anyway - we've already anonymized the data
    }

    return NextResponse.json(
      {
        success: true,
        status: 'deleted',
        message: 'Account deletion initiated',
        details: 'Your personal data has been anonymized. Reviews are retained in anonymized form per our data retention policy.',
        contactSupport: 'For complete erasure requests, please contact support@pawscities.com',
        gdprArticle: 'Article 17 - Right to Erasure',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting user account:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete account',
        message: error instanceof Error ? error.message : 'Unknown error',
        gdprArticle: 'Article 17 - Right to Erasure',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    { allowed: ['GET', 'POST'] },
    { status: 200 }
  );
}

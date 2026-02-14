/**
 * Login Event Logging API
 * Tracks user login events and metadata for security and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { logDataProcessing } from '@/lib/gdpr';
import { extractRequestInfo, checkRateLimitMiddleware } from '@/lib/security';

/**
 * POST /api/auth/login-event
 * Log user login event with metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResponse = checkRateLimitMiddleware(request, 'login');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { userId, provider = 'email', isFirstLogin = false } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid userId' },
        { status: 400 }
      );
    }

    if (!['email', 'google', 'github', 'apple'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const { ip, userAgent } = extractRequestInfo(request);

    // Log the login event
    await logDataProcessing(
      userId,
      'login',
      {
        provider,
        isFirstLogin,
        timestamp: new Date().toISOString(),
        metadata: {
          userAgent: userAgent,
          ipAddress: ip,
        },
      },
      ip,
      userAgent
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Login event logged',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error logging login event:', error);

    return NextResponse.json(
      {
        error: 'Failed to log login event',
        message: error instanceof Error ? error.message : 'Unknown error',
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
    { allowed: ['POST'] },
    { status: 200 }
  );
}

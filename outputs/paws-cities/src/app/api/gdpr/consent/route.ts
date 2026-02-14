/**
 * GDPR Consent Management API
 * GET: Retrieve user's consent preferences
 * POST: Update user's consent preferences
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { updateConsent, getConsentRecords } from '@/lib/gdpr';
import { extractRequestInfo, checkRateLimitMiddleware } from '@/lib/security';

/**
 * GET /api/gdpr/consent
 * Retrieve current consent preferences
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

    const consents = await getConsentRecords(user.id);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      consents,
      message: 'Consent preferences retrieved successfully',
    });
  } catch (error) {
    console.error('Error retrieving consent:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve consent preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gdpr/consent
 * Update consent preferences
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { analytics = false, marketing = false } = body;

    // Validate consent types
    if (typeof analytics !== 'boolean' || typeof marketing !== 'boolean') {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'analytics and marketing must be boolean values',
        },
        { status: 400 }
      );
    }

    const { ip, userAgent } = extractRequestInfo(request);

    // Update consent preferences
    await updateConsent(
      user.id,
      {
        analytics,
        marketing,
      },
      ip,
      userAgent
    );

    // Get updated consents
    const consents = await getConsentRecords(user.id);

    return NextResponse.json(
      {
        success: true,
        userId: user.id,
        consents,
        message: 'Consent preferences updated successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating consent:', error);
    return NextResponse.json(
      {
        error: 'Failed to update consent preferences',
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
    { allowed: ['GET', 'POST'] },
    { status: 200 }
  );
}

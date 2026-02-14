/**
 * GDPR Audit Trail API
 * GET: Retrieve user's data processing audit trail
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getAuditTrail, anonymizeLogData } from '@/lib/gdpr';
import { checkRateLimitMiddleware } from '@/lib/security';
import { prisma } from '@/lib/db';

/**
 * GET /api/gdpr/audit-trail?days=30
 * Retrieve data processing audit trail
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

    // Find user in database
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

    // Parse query parameter for days
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '90', 10);

    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Days parameter must be between 1 and 365' },
        { status: 400 }
      );
    }

    // Get audit trail
    const auditTrail = await getAuditTrail(dbUser.id, days);

    // Anonymize sensitive data in logs
    const anonymizedTrail = auditTrail.map(log => ({
      id: log.id,
      eventType: log.eventType,
      timestamp: log.timestamp,
      details: log.details ? anonymizeLogData(log.details) : null,
    }));

    return NextResponse.json({
      userId: user.id,
      email: '[redacted]', // Don't expose email
      auditTrail: anonymizedTrail,
      summary: {
        totalEvents: anonymizedTrail.length,
        eventTypes: anonymizedTrail.reduce((acc: Record<string, number>, log) => {
          acc[log.eventType] = (acc[log.eventType] || 0) + 1;
          return acc;
        }, {}),
        dateRange: {
          from: days === 365 ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        },
      },
      gdprArticle: 'Article 12 - Transparent Information',
    });
  } catch (error) {
    console.error('Error retrieving audit trail:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve audit trail',
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
    { allowed: ['GET'] },
    { status: 200 }
  );
}

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { exportUserData } from '@/lib/gdpr';
import { checkRateLimitMiddleware } from '@/lib/security';
import { prisma } from '@/lib/db';

/**
 * GET /api/gdpr/export
 * Export user's personal data in GDPR-compliant format
 * Article 20 - Right to Data Portability
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate limiting (stricter for GDPR endpoints)
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

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Export all user data
    const exportData = await exportUserData(dbUser.id);

    // Return as downloadable file
    const filename = `pawscities-data-export-${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : 'Unknown error',
        gdprArticle: 'Article 20 - Right to Data Portability',
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

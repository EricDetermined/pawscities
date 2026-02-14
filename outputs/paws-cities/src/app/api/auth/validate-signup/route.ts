import { NextRequest, NextResponse } from 'next/server';
import { validateBotPrevention } from '@/lib/bot-prevention';

/**
 * Server-side validation endpoint for signup
 * Validates honeypot, timing, and rate limiting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    const result = validateBotPrevention({
      honeypot: body.honeypot,
      timestamp: body.timestamp,
      ip,
    });

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { valid: false, errors: ['Validation failed'] },
      { status: 400 }
    );
  }
}

/**
 * Security Utilities
 * Rate limiting, CSRF validation, input sanitization, and security helpers
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SECURITY_CONFIG, generateCSRFToken, sanitizeInput, validatePassword } from '@/lib/security-config';

/**
 * Rate limiter using in-memory store
 */
class RateLimiter {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  check(ip: string, endpoint: keyof typeof SECURITY_CONFIG.rateLimiting): boolean {
    const config = SECURITY_CONFIG.rateLimiting[endpoint];
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || now > entry.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + config.windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= config.maxRequests;
  }

  getRemainingRequests(ip: string, endpoint: keyof typeof SECURITY_CONFIG.rateLimiting): number {
    const config = SECURITY_CONFIG.rateLimiting[endpoint];
    const key = `${ip}:${endpoint}`;
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.resetTime) return config.maxRequests;
    return Math.max(0, config.maxRequests - entry.count);
  }

  reset(ip: string, endpoint?: keyof typeof SECURITY_CONFIG.rateLimiting): void {
    if (endpoint) { this.store.delete(`${ip}:${endpoint}`); }
    else { Array.from(this.store.keys()).filter(k => k.startsWith(ip)).forEach(k => this.store.delete(k)); }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) { if (now > entry.resetTime) this.store.delete(key); }
  }
}

export const rateLimiter = new RateLimiter();

if (typeof window === 'undefined') { setInterval(() => rateLimiter.cleanup(), 60 * 60 * 1000); }

/**
 * CSRF Token Manager
 */
class CSRFTokenManager {
  private tokens: Map<string, { token: string; expiresAt: number }> = new Map();

  generate(sessionId: string): string {
    const token = generateCSRFToken();
    this.tokens.set(sessionId, { token, expiresAt: Date.now() + SECURITY_CONFIG.token.csrfExpiry });
    return token;
  }

  validate(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) { this.tokens.delete(sessionId); return false; }
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored.token));
  }

  revoke(sessionId: string): void { this.tokens.delete(sessionId); }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.tokens.entries()) { if (now > entry.expiresAt) this.tokens.delete(key); }
  }
}

export const csrfManager = new CSRFTokenManager();

if (typeof window === 'undefined') { setInterval(() => csrfManager.cleanup(), 60 * 60 * 1000); }

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function checkRateLimitMiddleware(request: NextRequest, endpoint: keyof typeof SECURITY_CONFIG.rateLimiting): NextResponse | null {
  const ip = getClientIP(request);
  const allowed = rateLimiter.check(ip, endpoint);
  if (!allowed) {
    const remaining = rateLimiter.getRemainingRequests(ip, endpoint);
    return new NextResponse(JSON.stringify({ error: 'Too many requests', remaining }), {
      status: 429,
      headers: { 'X-RateLimit-Limit': String(SECURITY_CONFIG.rateLimiting[endpoint].maxRequests), 'X-RateLimit-Remaining': String(remaining), 'Retry-After': '60' },
    });
  }
  return null;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateSecureString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function validateEmail(email: string): boolean {
  return SECURITY_CONFIG.validation.patterns.email.test(email) && email.length <= SECURITY_CONFIG.validation.maxLengths.email;
}

export function validateURL(url: string): boolean {
  return SECURITY_CONFIG.validation.patterns.url.test(url) && url.length <= SECURITY_CONFIG.validation.maxLengths.url;
}

export function validateSlug(slug: string): boolean {
  return SECURITY_CONFIG.validation.patterns.slug.test(slug) && slug.length > 0;
}

export function sanitizeUserInput(input: string, maxLength?: number): string {
  return sanitizeInput(input, maxLength);
}

export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export function createWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = createWebhookSignature(payload, secret);
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature)); }
  catch { return false; }
}

export function extractRequestInfo(request: NextRequest): { ip: string; userAgent: string; referer: string | null; country?: string; } {
  return { ip: getClientIP(request), userAgent: request.headers.get('user-agent') || 'unknown', referer: request.headers.get('referer') };
}

export function validateCORS(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return SECURITY_CONFIG.cors.allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed.includes('*')) { return new RegExp(`^${allowed.replace(/\\*/g, '.*')}$`).test(origin); }
    return origin === allowed;
  });
}

export function getCORSHeaders(origin: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': SECURITY_CONFIG.cors.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': SECURITY_CONFIG.cors.allowedHeaders.join(', '),
    'Access-Control-Expose-Headers': SECURITY_CONFIG.cors.exposedHeaders.join(', '),
    'Access-Control-Max-Age': String(SECURITY_CONFIG.cors.maxAge),
  };
  if (origin && validateCORS(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    if (SECURITY_CONFIG.cors.credentials) headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

export function isTrustedSource(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin || !validateCORS(origin)) return false;
  const referer = request.headers.get('referer');
  if (referer) { try { return new URL(referer).origin === origin; } catch { return false; } }
  return true;
}

export function getSecurityHeaders(): Record<string, string> {
  return SECURITY_CONFIG.headers;
}

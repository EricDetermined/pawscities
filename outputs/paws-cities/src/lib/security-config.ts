/**
 * Security Configuration
 * CSP headers, CORS, rate limiting, and security policies
 */

export const SECURITY_CONFIG = {
  // Content Security Policy
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://cdn.tailwindcss.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdn.tailwindcss.com'],
      'img-src': ["'self'", 'data:', 'https:', 'blob:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'https://*.supabase.co', 'https://*.anthropic.com', 'https://api.anthropic.com'],
      'frame-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    },
  },

  // CORS configuration
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.NEXT_PUBLIC_APP_URL || 'https://pawscities.com',
    ].filter(Boolean),
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  // Rate limiting configuration
  rateLimiting: {
    api: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
      skipSuccessfulRequests: true,
    },
    login: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
      skipSuccessfulRequests: true,
    },
    signup: {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
      skipSuccessfulRequests: true,
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
      skipSuccessfulRequests: true,
    },
    gdpr: {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 1,
      skipSuccessfulRequests: false,
    },
  },

  webhooks: {
    supabase: {
      secret: process.env.SUPABASE_WEBHOOK_SECRET || '',
      timeout: 5000,
      retries: 3,
    },
  },

  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  },

  session: {
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },

  password: {
    minLength: 12,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  },

  token: {
    csrfExpiry: 60 * 60 * 1000,
    sessionExpiry: 7 * 24 * 60 * 60 * 1000,
    refreshExpiry: 30 * 24 * 60 * 60 * 1000,
  },

  validation: {
    maxLengths: {
      email: 254,
      name: 255,
      textarea: 5000,
      url: 2048,
    },
    patterns: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/.+/,
      alphanumeric: /^[a-zA-Z0-9]+$/,
      slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
  },

  gdpr: {
    dataRetentionDays: 90,
    logsRetentionDays: 180,
    deletionGracePeriodDays: 30,
    consentVersion: '1.0',
  },
};

export function generateCSPHeader(): string {
  const directives = SECURITY_CONFIG.csp.directives as Record<string, string[]>;
  return Object.entries(directives)
    .map(([key, values]) => {
      const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1);
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return SECURITY_CONFIG.cors.allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(pattern).test(origin);
    }
    return origin === allowed;
  });
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { password: config } = SECURITY_CONFIG;
  if (password.length < config.minLength) errors.push(`Password must be at least ${config.minLength} characters long`);
  if (config.requireUppercase && !/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (config.requireNumbers && !/\d/.test(password)) errors.push('Password must contain at least one number');
  if (config.requireSpecialChars && !new RegExp(`[${config.specialChars}]`).test(password)) errors.push('Password must contain at least one special character');
  return { valid: errors.length === 0, errors };
}

export function sanitizeInput(input: string, maxLength: number = 1000): string {
  return input.slice(0, maxLength).replace(/[<>]/g, '').trim();
}

export function generateCSRFToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

export function checkRateLimit(
  ip: string,
  endpoint: keyof typeof SECURITY_CONFIG.rateLimiting,
  requestCount: number
): { allowed: boolean; remaining: number; resetTime: Date } {
  const config = SECURITY_CONFIG.rateLimiting[endpoint];
  const remaining = Math.max(0, config.maxRequests - requestCount);
  return { allowed: remaining > 0, remaining, resetTime: new Date(Date.now() + config.windowMs) };
}

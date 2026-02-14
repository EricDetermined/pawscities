/**
 * Bot prevention utilities
 * Implements honeypot fields, timing validation, and rate limiting
 */

// In-memory store for rate limiting (in production, use Redis or similar)
const ipRequestMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Honeypot field validation
 * Bots typically fill all fields, including hidden ones
 */
export function validateHoneypot(honeypotValue?: string): boolean {
  // If honeypot field has any value, it's likely a bot
  return !honeypotValue || honeypotValue.trim() === '';
}

/**
 * Timing validation
 * Form should take at least 3 seconds to fill
 */
export function validateTiming(submittedAtMs: number): boolean {
  const formStartTime = submittedAtMs - (Date.now() - submittedAtMs);
  const timeTaken = submittedAtMs - formStartTime;
  const MIN_TIME_MS = 3000; // 3 seconds
  return timeTaken >= MIN_TIME_MS;
}

/**
 * Rate limiting per IP
 * Max 3 signups per hour per IP
 */
export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  // Clean up old entries
  ipRequestMap.forEach((value, key) => {
    if (value.resetTime < now) {
      ipRequestMap.delete(key);
    }
  });

  const entry = ipRequestMap.get(ip);

  if (!entry) {
    ipRequestMap.set(ip, {
      count: 1,
      resetTime: now + ONE_HOUR,
    });
    return { allowed: true, remaining: 2 };
  }

  const MAX_REQUESTS = 3;

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}

/**
 * Validate bot prevention checks
 * Returns true if all checks pass (not a bot)
 */
export interface BotPreventionData {
  honeypot?: string;
  timestamp?: number;
  ip?: string;
}

export function validateBotPrevention(data: BotPreventionData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check honeypot
  if (!validateHoneypot(data.honeypot)) {
    errors.push('Invalid form submission detected');
  }

  // Check timing
  if (data.timestamp && !validateTiming(data.timestamp)) {
    errors.push('Form submission too fast');
  }

  // Check rate limit
  if (data.ip) {
    const rateLimit = checkRateLimit(data.ip);
    if (!rateLimit.allowed) {
      errors.push('Too many signup attempts. Please try again later.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Admin utilities and constants
 */

export const ADMIN_EMAILS = [
  'eric.silverstein@icloud.com',
];

/**
 * Check if a user email belongs to an admin
 */
export function isAdminEmail(email?: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Check if a user has admin role
 * Can check via email or app_metadata.role
 */
export function isAdmin(email?: string, role?: string): boolean {
  if (role === 'admin') return true;
  return isAdminEmail(email);
}

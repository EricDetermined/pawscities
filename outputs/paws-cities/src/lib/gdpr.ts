/**
 * GDPR Compliance Module
 * Handles data export, deletion, consent management, and processing logs
 */

import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export interface GDPRUserData {
  exportDate: string;
  gdprArticle: string;
  user: { email: string; name: string | null; language: string; homeCity: string | null; role: string; createdAt: Date; };
  dogs: any[];
  reviews: any[];
  favorites: any[];
  checkIns: any[];
  activities: any[];
  consent: ConsentRecord[];
  summary: { totalDogs: number; totalReviews: number; totalFavorites: number; totalCheckIns: number; totalActivities: number; dataRetentionDays: number; lastAccessDate: string; };
}

export interface ConsentRecord {
  type: 'necessary' | 'analytics' | 'marketing';
  consented: boolean;
  timestamp: string;
  version: string;
}

export interface DataProcessingLog {
  id: string;
  userId: string;
  eventType: 'export' | 'deletion' | 'consent_update' | 'login' | 'data_access';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Export all user data - GDPR Article 20 Right to Data Portability
 */
export async function exportUserData(userId: string): Promise<GDPRUserData> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const [dogs, reviews, favorites, checkIns, activities, consent] = await Promise.all([
    prisma.dogProfile.findMany({ where: { userId } }),
    prisma.review.findMany({ where: { userId } }),
    prisma.favorite.findMany({ where: { userId }, include: { establishment: true } }),
    prisma.checkIn.findMany({ where: { userId }, include: { establishment: true } }),
    prisma.activity.findMany({ where: { userId } }),
    getConsentRecords(userId),
  ]);

  await logDataProcessing(userId, 'export', { dataType: 'full_export', recordCount: dogs.length + reviews.length + favorites.length + checkIns.length });

  return {
    exportDate: new Date().toISOString(),
    gdprArticle: 'Article 20 - Right to Data Portability',
    user: { email: user.email, name: user.name, language: user.language, homeCity: user.homeCity, role: user.role, createdAt: user.createdAt },
    dogs: dogs.map(dog => ({ id: dog.id, name: dog.name, breed: dog.breed, birthDate: dog.birthDate, size: dog.size, createdAt: dog.createdAt })),
    reviews: reviews.map(review => ({ id: review.id, rating: review.rating, title: review.title, content: review.content, createdAt: review.createdAt })),
    favorites: favorites.map(fav => ({ id: fav.id, establishmentName: fav.establishment.name, createdAt: fav.createdAt })),
    checkIns: checkIns.map(checkin => ({ id: checkin.id, establishmentName: checkin.establishment.name, note: checkin.note, createdAt: checkin.createdAt })),
    activities: activities.map(activity => ({ id: activity.id, type: activity.type, createdAt: activity.createdAt })),
    consent,
    summary: { totalDogs: dogs.length, totalReviews: reviews.length, totalFavorites: favorites.length, totalCheckIns: checkIns.length, totalActivities: activities.length, dataRetentionDays: 90, lastAccessDate: new Date().toISOString() },
  };
}

/**
 * Delete user data - GDPR Article 17 Right to be Forgotten
 */
export async function deleteUserData(userId: string, options = { anonymize: true }): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  await logDataProcessing(userId, 'deletion', { anonymize: options.anonymize, timestamp: new Date().toISOString() });

  if (options.anonymize) {
    await prisma.review.updateMany({ where: { userId }, data: { title: '[Deleted]', content: 'This review was removed by the user.', dogNames: null, reviewPhotos: [], userId: userId } });
  } else {
    await prisma.review.deleteMany({ where: { userId } });
  }

  await Promise.all([
    prisma.dogProfile.deleteMany({ where: { userId } }),
    prisma.favorite.deleteMany({ where: { userId } }),
    prisma.checkIn.deleteMany({ where: { userId } }),
    prisma.activity.deleteMany({ where: { userId } }),
    prisma.businessClaim.deleteMany({ where: { userId } }),
    prisma.storyLike.deleteMany({ where: { userId } }),
    prisma.storyComment.deleteMany({ where: { userId } }),
    prisma.reviewHelpful.deleteMany({ where: { userId } }),
  ]);

  await prisma.user.update({ where: { id: userId }, data: { email: `deleted-${userId}@deleted.pawscities.local`, name: 'Deleted User', avatar: null, homeCity: null } });
}

/**
 * Get or create consent preferences for user
 */
export async function getConsentRecords(userId: string): Promise<ConsentRecord[]> {
  const consentLogEntries = await prisma.dataProcessingLog.findMany({ where: { userId, eventType: 'consent_update' }, orderBy: { timestamp: 'desc' }, take: 1 });

  if (consentLogEntries.length === 0) {
    return [
      { type: 'necessary', consented: true, timestamp: new Date().toISOString(), version: '1.0' },
      { type: 'analytics', consented: false, timestamp: new Date().toISOString(), version: '1.0' },
      { type: 'marketing', consented: false, timestamp: new Date().toISOString(), version: '1.0' },
    ];
  }

  return consentLogEntries[0].details?.consents || [];
}

/**
 * Update user consent preferences
 */
export async function updateConsent(userId: string, consents: Record<string, boolean>, ipAddress?: string, userAgent?: string): Promise<void> {
  const consentRecords: ConsentRecord[] = [
    { type: 'necessary', consented: true, timestamp: new Date().toISOString(), version: '1.0' },
    { type: 'analytics', consented: consents.analytics || false, timestamp: new Date().toISOString(), version: '1.0' },
    { type: 'marketing', consented: consents.marketing || false, timestamp: new Date().toISOString(), version: '1.0' },
  ];

  await logDataProcessing(userId, 'consent_update', { consents: consentRecords, changedFields: Object.keys(consents) }, ipAddress, userAgent);
}

/**
 * Log data processing events for audit trail
 */
export async function logDataProcessing(userId: string, eventType: DataProcessingLog['eventType'], details?: Record<string, any>, ipAddress?: string, userAgent?: string): Promise<void> {
  try {
    await prisma.dataProcessingLog.create({ data: { userId, eventType, ipAddress, userAgent, details, timestamp: new Date() } });
  } catch (error) {
    console.error('Failed to log data processing event:', error);
  }
}

/**
 * Get data processing audit trail for user
 */
export async function getAuditTrail(userId: string, days: number = 90): Promise<DataProcessingLog[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return prisma.dataProcessingLog.findMany({ where: { userId, timestamp: { gte: since } }, orderBy: { timestamp: 'desc' } });
}

/**
 * Check if data retention period has passed
 */
export function isDataRetentionExpired(createdAt: Date, retentionDays: number = 90): boolean {
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + retentionDays);
  return new Date() > expiryDate;
}

/**
 * Anonymize sensitive data in logs
 */
export function anonymizeLogData(data: any): any {
  const sanitized = { ...data };
  if (sanitized.ipAddress) sanitized.ipAddress = sanitized.ipAddress.split('.').slice(0, 3).join('.') + '.***';
  if (sanitized.userAgent) sanitized.userAgent = '[User Agent Masked]';
  if (sanitized.email) { const [local, domain] = sanitized.email.split('@'); sanitized.email = local[0] + '***@' + domain; }
  return sanitized;
}

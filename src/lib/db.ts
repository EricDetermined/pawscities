// Prisma client stub - will be initialized when database is connected
// For now, all data is served from JSON files via src/lib/data.ts

let _prisma: any = null;

function getPrismaClient() {
  if (_prisma) return _prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    const globalForPrisma = globalThis as unknown as { prisma: any };
    _prisma = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _prisma;
    }
    return _prisma;
  } catch {
    // Prisma not available - return a proxy that throws helpful errors
    return new Proxy({}, {
      get: () => new Proxy({}, {
        get: () => async () => {
          throw new Error('Database not connected. Prisma client not available.');
        },
      }),
    });
  }
}

export const prisma = getPrismaClient();
export default prisma;

import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment';

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (dev) {
	globalForPrisma.prisma = prisma;
}

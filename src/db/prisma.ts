import { PrismaClient, Prisma } from '@prisma/client';
import { isProduction } from '../config/env';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: isProduction
    ? [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }]
    : [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }],
});

prisma.$on('error', (event) => logger.error({ event }, 'prisma error'));
prisma.$on('warn', (event) => logger.warn({ event }, 'prisma warning'));

/**
 * Anything that can run a query: the root client or an interactive transaction.
 * Services accept this so they can be composed inside a single DB transaction.
 */
export type Db = Prisma.TransactionClient | PrismaClient;

export const UNIQUE_VIOLATION = 'P2002';

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}

/** Serializable transaction with sane timeouts for economy critical paths. */
export async function runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { timeout: 15_000, maxWait: 10_000 });
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('database disconnected');
}

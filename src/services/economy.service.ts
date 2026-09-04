import { Prisma, TransactionDirection } from '@prisma/client';
import { economyConfig } from '../config/game.config';
import { isUniqueViolation, prisma, runInTransaction, type Db } from '../db/prisma';
import { childLogger } from '../utils/logger';

const log = childLogger('economy');

export class InsufficientFundsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient funds: required ${required}, available ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

export interface LedgerOperation {
  userId: string;
  /** Positive number; the direction carries the sign. */
  amount: number;
  direction: TransactionDirection;
  /** Machine readable reason, e.g. `daily_bonus`, `shop_purchase`. */
  reason: string;
  metadata?: Prisma.InputJsonValue;
  /** Required for anything that must never be applied twice. */
  idempotencyKey?: string;
}

export interface LedgerResult {
  applied: boolean;
  balance: number;
  transactionId: string | null;
}

/**
 * Economy service.
 *
 * Invariants:
 *  1. `User.balance` is only ever changed through {@link applyLedger}.
 *  2. Every change produces an `EconomyTransaction` row (append only ledger).
 *  3. Operations carrying an `idempotencyKey` are safe to replay.
 *  4. Balance can never become negative.
 */
export const economyService = {
  async getBalance(userId: string, db: Db = prisma): Promise<number> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { balance: true } });
    return user?.balance ?? 0;
  },

  /**
   * Applies a ledger operation inside the provided transaction client.
   * The caller MUST already be inside a DB transaction, otherwise use
   * {@link credit} / {@link debit} which open one for you.
   */
  async applyLedger(tx: Prisma.TransactionClient, op: LedgerOperation): Promise<LedgerResult> {
    if (!Number.isInteger(op.amount) || op.amount < 0) {
      throw new Error(`Ledger amount must be a non-negative integer, received ${op.amount}`);
    }
    if (op.amount > economyConfig.maxSingleTransaction) {
      throw new Error(`Ledger amount ${op.amount} exceeds the configured maximum`);
    }

    if (op.idempotencyKey) {
      const existing = await tx.economyTransaction.findUnique({
        where: { idempotencyKey: op.idempotencyKey },
        select: { id: true, balanceAfter: true },
      });
      if (existing) {
        return { applied: false, balance: existing.balanceAfter, transactionId: existing.id };
      }
    }

    // Row level lock: serialises concurrent balance mutations for this user.
    const locked = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT "balance" FROM "User" WHERE "id" = ${op.userId} FOR UPDATE
    `;
    const currentBalance = locked[0]?.balance;
    if (currentBalance === undefined) {
      throw new Error(`Cannot apply ledger operation: user ${op.userId} not found`);
    }

    if (op.amount === 0) {
      return { applied: false, balance: currentBalance, transactionId: null };
    }

    const delta = op.direction === TransactionDirection.CREDIT ? op.amount : -op.amount;
    const nextBalance = currentBalance + delta;

    if (nextBalance < economyConfig.minBalance) {
      throw new InsufficientFundsError(op.amount, currentBalance);
    }

    try {
      const transaction = await tx.economyTransaction.create({
        data: {
          userId: op.userId,
          direction: op.direction,
          amount: op.amount,
          balanceAfter: nextBalance,
          reason: op.reason,
          metadata: op.metadata ?? Prisma.JsonNull,
          idempotencyKey: op.idempotencyKey ?? null,
        },
        select: { id: true },
      });

      await tx.user.update({ where: { id: op.userId }, data: { balance: nextBalance } });

      log.info(
        { userId: op.userId, delta, reason: op.reason, balanceAfter: nextBalance },
        'economy transaction applied',
      );

      return { applied: true, balance: nextBalance, transactionId: transaction.id };
    } catch (error) {
      if (isUniqueViolation(error) && op.idempotencyKey) {
        const existing = await tx.economyTransaction.findUnique({
          where: { idempotencyKey: op.idempotencyKey },
          select: { id: true, balanceAfter: true },
        });
        if (existing) {
          return { applied: false, balance: existing.balanceAfter, transactionId: existing.id };
        }
      }
      throw error;
    }
  },

  async credit(op: Omit<LedgerOperation, 'direction'>): Promise<LedgerResult> {
    return runInTransaction((tx) => economyService.applyLedger(tx, { ...op, direction: TransactionDirection.CREDIT }));
  },

  async debit(op: Omit<LedgerOperation, 'direction'>): Promise<LedgerResult> {
    return runInTransaction((tx) => economyService.applyLedger(tx, { ...op, direction: TransactionDirection.DEBIT }));
  },

  async listTransactions(userId: string, take = 20) {
    return prisma.economyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  /** Sums the ledger; used by admin tooling to verify the cached balance. */
  async auditBalance(userId: string): Promise<{ ledger: number; cached: number; consistent: boolean }> {
    const [aggregate, user] = await Promise.all([
      prisma.economyTransaction.groupBy({
        by: ['direction'],
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { balance: true } }),
    ]);

    const credit = aggregate.find((row) => row.direction === TransactionDirection.CREDIT)?._sum.amount ?? 0;
    const debit = aggregate.find((row) => row.direction === TransactionDirection.DEBIT)?._sum.amount ?? 0;
    const ledger = credit - debit;
    const cached = user?.balance ?? 0;

    return { ledger, cached, consistent: ledger === cached };
  },
};

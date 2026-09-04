import { TransactionDirection, type Reward, type User } from '@prisma/client';
import { isUniqueViolation, prisma, runInTransaction } from '../db/prisma';
import { childLogger } from '../utils/logger';
import { lockKey, withLock } from '../utils/mutex';
import { economyService, InsufficientFundsError } from './economy.service';

const log = childLogger('personal-reward');

export type PersonalRewardPurchaseResult =
  | { ok: true; reward: Reward; purchaseId: string; balance: number }
  | { ok: false; reason: 'not_found' | 'inactive' | 'limit_reached' }
  | { ok: false; reason: 'insufficient_funds'; price: number; balance: number };

/**
 * Admin authored rewards: title, price and arbitrary Telegram content.
 * Nothing about a concrete reward lives in code — everything comes from the DB.
 */
export const personalRewardService = {
  async list(includeInactive = false) {
    return prisma.reward.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async get(rewardId: string) {
    return prisma.reward.findUnique({ where: { id: rewardId } });
  },

  async listOwned(userId: string) {
    return prisma.rewardPurchase.findMany({
      where: { userId },
      include: { reward: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async purchase(user: User, rewardId: string): Promise<PersonalRewardPurchaseResult> {
    return withLock(lockKey('reward', user.id), async () => {
      const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
      if (!reward) return { ok: false, reason: 'not_found' };
      if (!reward.isActive) return { ok: false, reason: 'inactive' };

      if (reward.perUserLimit !== null) {
        const owned = await prisma.rewardPurchase.count({ where: { userId: user.id, rewardId: reward.id } });
        if (owned >= reward.perUserLimit) return { ok: false, reason: 'limit_reached' };
      }

      const idempotencyKey = `reward:${user.id}:${reward.id}:${Date.now()}`;

      try {
        const result = await runInTransaction(async (tx) => {
          const ledger = await economyService.applyLedger(tx, {
            userId: user.id,
            amount: reward.price,
            direction: TransactionDirection.DEBIT,
            reason: 'personal_reward_purchase',
            metadata: { rewardId: reward.id, rewardCode: reward.code },
            idempotencyKey,
          });

          const purchase = await tx.rewardPurchase.create({
            data: { userId: user.id, rewardId: reward.id, price: reward.price, idempotencyKey },
            select: { id: true },
          });

          return { purchaseId: purchase.id, balance: ledger.balance };
        });

        log.info({ userId: user.id, rewardCode: reward.code }, 'personal reward purchased');
        return { ok: true, reward, purchaseId: result.purchaseId, balance: result.balance };
      } catch (error) {
        if (error instanceof InsufficientFundsError) {
          return { ok: false, reason: 'insufficient_funds', price: reward.price, balance: error.available };
        }
        if (isUniqueViolation(error)) return { ok: false, reason: 'limit_reached' };
        throw error;
      }
    });
  },

  async markOpened(purchaseId: string): Promise<void> {
    await prisma.rewardPurchase.updateMany({
      where: { id: purchaseId, openedAt: null },
      data: { openedAt: new Date() },
    });
  },
};

import { GameEventType, Prisma, TransactionDirection } from '@prisma/client';
import type { RewardBundleConfig } from '../config/game.config';
import { levelConfig } from '../config/game.config';
import { prisma, runInTransaction, type Db } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { getLevelProgress, levelForXp } from './level';

const log = childLogger('reward');

export type RewardBundle = RewardBundleConfig;

export interface GrantOptions {
  userId: string;
  bundle: RewardBundle;
  /** Machine readable source, e.g. `streak_milestone:7`. */
  reason: string;
  /** Required so a replayed Telegram update cannot pay out twice. */
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
}

export interface GrantResult {
  applied: boolean;
  currency: number;
  xp: number;
  streakShields: number;
  balance: number;
  levelUp: { from: number; to: number } | null;
  unlockedAchievements: Array<{ code: string; title: string; icon: string }>;
  items: Array<{ code: string; quantity: number }>;
}

const EMPTY_RESULT = (balance: number): GrantResult => ({
  applied: false,
  currency: 0,
  xp: 0,
  streakShields: 0,
  balance,
  levelUp: null,
  unlockedAchievements: [],
  items: [],
});

/**
 * Single funnel for handing anything to a user.
 *
 * Game rules never mutate balance / xp / shields directly: they describe a
 * configured reward bundle and delegate here. That keeps the ledger complete
 * and makes rewards fully data driven.
 */
export const rewardService = {
  /** Grants a bundle inside an existing transaction. */
  async grantInTransaction(tx: Prisma.TransactionClient, options: GrantOptions): Promise<GrantResult> {
    const { userId, bundle, reason, idempotencyKey } = options;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { balance: true, xp: true, level: true, streakShields: true },
    });
    if (!user) throw new Error(`Cannot grant reward: user ${userId} not found`);

    const currency = Math.max(0, Math.trunc(bundle.currency ?? 0));
    const xp = Math.max(0, Math.trunc(bundle.xp ?? 0));
    const shields = Math.max(0, Math.trunc(bundle.streakShields ?? 0));
    const items = bundle.items ?? [];

    if (!currency && !xp && !shields && !items.length) {
      return EMPTY_RESULT(user.balance);
    }

    // A marker row makes the whole bundle idempotent, not just the currency part.
    const marker = await tx.economyTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true, balanceAfter: true },
    });
    if (marker) {
      return EMPTY_RESULT(marker.balanceAfter);
    }

    // Lock the user row so concurrent grants serialise.
    const locked = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT "balance" FROM "User" WHERE "id" = ${userId} FOR UPDATE
    `;
    const balanceBefore = locked[0]?.balance ?? user.balance;
    const balanceAfter = balanceBefore + currency;

    await tx.economyTransaction.create({
      data: {
        userId,
        direction: TransactionDirection.CREDIT,
        amount: currency,
        balanceAfter,
        reason,
        metadata: (options.metadata ?? { bundle }) as unknown as Prisma.InputJsonValue,
        idempotencyKey,
      },
    });

    const xpBefore = user.xp;
    const xpAfter = xpBefore + xp;
    const levelBefore = user.level;
    const levelAfter = levelForXp(xpAfter);

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: balanceAfter,
        xp: xpAfter,
        level: levelAfter,
        streakShields: { increment: shields },
      },
    });

    for (const item of items) {
      await tx.inventoryItem.upsert({
        where: { userId_code: { userId, code: item.code } },
        create: { userId, code: item.code, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      });
    }

    log.info({ userId, reason, currency, xp, shields }, 'reward granted');

    return {
      applied: true,
      currency,
      xp,
      streakShields: shields,
      balance: balanceAfter,
      levelUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null,
      unlockedAchievements: [],
      items,
    };
  },

  /** Grants a bundle, opening its own transaction, then emits follow-up events. */
  async grant(options: GrantOptions): Promise<GrantResult> {
    const result = await runInTransaction((tx) => rewardService.grantInTransaction(tx, options));

    if (result.applied) {
      await gameEvents.emit(GameEventType.REWARD_GRANTED, { userId: options.userId, reason: options.reason });
    }

    if (result.levelUp) {
      await rewardService.handleLevelUp(options.userId, result.levelUp.from, result.levelUp.to);
    }

    return result;
  },

  /** Applies configured level-up rewards for every level crossed. */
  async handleLevelUp(userId: string, fromLevel: number, toLevel: number): Promise<GrantResult[]> {
    const results: GrantResult[] = [];

    for (let level = fromLevel + 1; level <= toLevel; level += 1) {
      const bundles: Array<{ bundle: RewardBundle; key: string }> = [
        { bundle: levelConfig.levelUpReward, key: `level_up:${userId}:${level}` },
      ];
      const milestone = levelConfig.milestoneRewards[level];
      if (milestone) {
        bundles.push({ bundle: milestone, key: `level_milestone:${userId}:${level}` });
      }

      for (const entry of bundles) {
        results.push(
          await runInTransaction((tx) =>
            rewardService.grantInTransaction(tx, {
              userId,
              bundle: entry.bundle,
              reason: `level_reward:${level}`,
              idempotencyKey: entry.key,
            }),
          ),
        );
      }
    }

    await gameEvents.emit(GameEventType.LEVEL_UP, { userId, fromLevel, toLevel });
    return results;
  },

  async getProgress(userId: string, db: Db = prisma) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { xp: true } });
    return getLevelProgress(user?.xp ?? 0);
  },
};

export function mergeBundles(...bundles: Array<RewardBundle | undefined>): RewardBundle {
  const merged: RewardBundle = { currency: 0, xp: 0, streakShields: 0, items: [] };

  for (const bundle of bundles) {
    if (!bundle) continue;
    merged.currency = (merged.currency ?? 0) + (bundle.currency ?? 0);
    merged.xp = (merged.xp ?? 0) + (bundle.xp ?? 0);
    merged.streakShields = (merged.streakShields ?? 0) + (bundle.streakShields ?? 0);
    if (bundle.items?.length) merged.items = [...(merged.items ?? []), ...bundle.items];
  }

  return merged;
}

/** Parses a reward bundle stored as JSON in the database. */
export function parseRewardBundle(value: Prisma.JsonValue | null | undefined): RewardBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const bundle: RewardBundle = {};

  if (typeof record.currency === 'number') bundle.currency = record.currency;
  if (typeof record.xp === 'number') bundle.xp = record.xp;
  if (typeof record.streakShields === 'number') bundle.streakShields = record.streakShields;
  if (typeof record.message === 'string') bundle.message = record.message;
  if (Array.isArray(record.items)) {
    bundle.items = record.items
      .filter((item): item is { code: string; quantity: number } => {
        return (
          !!item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).code === 'string' &&
          typeof (item as Record<string, unknown>).quantity === 'number'
        );
      })
      .map((item) => ({ code: item.code, quantity: item.quantity }));
  }

  return bundle;
}

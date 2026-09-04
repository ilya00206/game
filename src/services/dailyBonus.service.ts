import { GameEventType, Prisma, type User } from '@prisma/client';
import { dailyBonusConfig, type RewardBundleConfig } from '../config/game.config';
import { isUniqueViolation, runInTransaction } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { getDayKey } from '../utils/time';
import { computeNextCycleDay, rewardForCycleDay } from './dailyBonus.logic';
import { rewardService } from './reward.service';

const log = childLogger('daily-bonus');

export interface DailyBonusStatus {
  available: boolean;
  dayInCycle: number;
  nextReward: RewardBundleConfig;
  cycle: ReadonlyArray<RewardBundleConfig>;
  currentBonusStreak: number;
}

export type ClaimResult =
  | { ok: true; dayInCycle: number; reward: RewardBundleConfig; balance: number; bonusStreak: number }
  | { ok: false; reason: 'already_claimed'; dayInCycle: number };

export const dailyBonusService = {
  getStatus(user: User, now = new Date()): DailyBonusStatus {
    const todayDayKey = getDayKey(now, user.timezone);
    const available = user.dailyBonusDay !== todayDayKey;
    const dayInCycle = computeNextCycleDay(user.dailyBonusDay, user.dailyBonusStreak, todayDayKey);

    return {
      available,
      dayInCycle,
      nextReward: rewardForCycleDay(dayInCycle),
      cycle: dailyBonusConfig.cycle,
      currentBonusStreak: user.dailyBonusStreak,
    };
  },

  /**
   * Claims today's bonus. The unique (userId, localDay) constraint on
   * DailyBonusClaim makes a second call a no-op, even under a replayed update.
   */
  async claim(user: User, now = new Date()): Promise<ClaimResult> {
    const todayDayKey = getDayKey(now, user.timezone);

    try {
      const result = await runInTransaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        const fresh = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { dailyBonusDay: true, dailyBonusStreak: true },
        });

        if (fresh.dailyBonusDay === todayDayKey) {
          return { ok: false as const, reason: 'already_claimed' as const, dayInCycle: fresh.dailyBonusStreak };
        }

        const dayInCycle = computeNextCycleDay(fresh.dailyBonusDay, fresh.dailyBonusStreak, todayDayKey);
        const reward = rewardForCycleDay(dayInCycle);

        await tx.dailyBonusClaim.create({
          data: {
            userId: user.id,
            localDay: todayDayKey,
            dayInCycle,
            reward: reward as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            dailyBonusDay: todayDayKey,
            dailyBonusStreak: dayInCycle,
            dailyBonusClaimedAt: now,
          },
        });

        const granted = await rewardService.grantInTransaction(tx, {
          userId: user.id,
          bundle: reward,
          reason: 'daily_bonus',
          idempotencyKey: `daily_bonus:${user.id}:${todayDayKey}`,
        });

        return {
          ok: true as const,
          dayInCycle,
          reward,
          balance: granted.balance,
          bonusStreak: dayInCycle,
        };
      });

      if (result.ok) {
        log.info({ userId: user.id, dayInCycle: result.dayInCycle }, 'daily bonus claimed');
        await gameEvents.emit(GameEventType.DAILY_BONUS_CLAIMED, {
          userId: user.id,
          dayInCycle: result.dayInCycle,
        });
      }

      return result;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: false, reason: 'already_claimed', dayInCycle: user.dailyBonusStreak };
      }
      throw error;
    }
  },
};

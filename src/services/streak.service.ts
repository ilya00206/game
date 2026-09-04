import { GameEventType, type User } from '@prisma/client';
import { streakConfig } from '../config/game.config';
import { prisma, runInTransaction } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { getDayKey } from '../utils/time';
import { rewardService } from './reward.service';
import { computeStreak, type StreakOutcome } from './streak.logic';

const log = childLogger('streak');

export interface StreakUpdateResult extends StreakOutcome {
  milestoneRewardApplied: boolean;
}

export const streakService = {
  /**
   * Registers daily activity. Safe to call multiple times per day: only the
   * first call of a local day changes anything.
   */
  async registerActivity(user: User, now = new Date()): Promise<StreakUpdateResult> {
    const todayDayKey = getDayKey(now, user.timezone);

    const outcome = await runInTransaction(async (tx) => {
      // Re-read under lock so two parallel session completions cannot both increment.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          currentStreak: true,
          longestStreak: true,
          lastActivityDay: true,
          streakShields: true,
        },
      });

      const computed = computeStreak({
        currentStreak: fresh.currentStreak,
        longestStreak: fresh.longestStreak,
        lastActivityDay: fresh.lastActivityDay,
        availableShields: fresh.streakShields,
        todayDayKey,
      });

      if (!computed.changed) return computed;

      await tx.user.update({
        where: { id: user.id },
        data: {
          currentStreak: computed.currentStreak,
          longestStreak: computed.longestStreak,
          lastActivityDay: todayDayKey,
          lastActivityAt: now,
          streakShields: { decrement: computed.shieldsConsumed },
          streakFrozenDays: computed.protectedByShield ? { increment: computed.shieldsConsumed } : undefined,
        },
      });

      return computed;
    });

    if (!outcome.changed) {
      return { ...outcome, milestoneRewardApplied: false };
    }

    log.info(
      { userId: user.id, streak: outcome.currentStreak, shielded: outcome.protectedByShield },
      'streak updated',
    );

    await gameEvents.emit(GameEventType.STREAK_UPDATED, {
      userId: user.id,
      currentStreak: outcome.currentStreak,
      protectedByShield: outcome.protectedByShield,
    });
    await gameEvents.emit(GameEventType.DAILY_ACTIVITY_COMPLETED, { userId: user.id, localDay: todayDayKey });

    let milestoneRewardApplied = false;
    if (outcome.milestoneReached) {
      const bundle = streakConfig.milestones[outcome.milestoneReached];
      if (bundle) {
        const granted = await rewardService.grant({
          userId: user.id,
          bundle,
          reason: `streak_milestone:${outcome.milestoneReached}`,
          idempotencyKey: `streak_milestone:${user.id}:${outcome.milestoneReached}`,
        });
        milestoneRewardApplied = granted.applied;
      }
      await gameEvents.emit(GameEventType.STREAK_MILESTONE_REACHED, {
        userId: user.id,
        milestone: outcome.milestoneReached,
      });
    }

    return { ...outcome, milestoneRewardApplied };
  },

  /** Next milestone the user is heading towards, if any. */
  nextMilestone(currentStreak: number): { target: number; remaining: number } | null {
    const targets = Object.keys(streakConfig.milestones)
      .map(Number)
      .sort((a, b) => a - b);
    const next = targets.find((target) => target > currentStreak);
    return next ? { target: next, remaining: next - currentStreak } : null;
  },

  async isActiveToday(user: Pick<User, 'lastActivityDay' | 'timezone'>, now = new Date()): Promise<boolean> {
    return user.lastActivityDay === getDayKey(now, user.timezone);
  },

  async addShields(userId: string, amount: number): Promise<number> {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { streakShields: { increment: amount } },
      select: { streakShields: true },
    });
    return updated.streakShields;
  },
};

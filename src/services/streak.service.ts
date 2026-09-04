import type { User } from '@prisma/client';
import { prisma, runInTransaction } from '../db/prisma';
import { childLogger } from '../utils/logger';
import { getDayKey } from '../utils/time';
import { computeStreak, type StreakOutcome } from './streak.logic';

const log = childLogger('streak');

export interface StreakUpdateResult extends StreakOutcome {
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
        },
      });

      const computed = computeStreak({
        currentStreak: fresh.currentStreak,
        longestStreak: fresh.longestStreak,
        lastActivityDay: fresh.lastActivityDay,
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
        },
      });

      return computed;
    });

    if (!outcome.changed) {
      return outcome;
    }

    log.info(
      { userId: user.id, streak: outcome.currentStreak },
      'streak updated',
    );

    return outcome;
  },

  async isActiveToday(user: Pick<User, 'lastActivityDay' | 'timezone'>, now = new Date()): Promise<boolean> {
    return user.lastActivityDay === getDayKey(now, user.timezone);
  },

};

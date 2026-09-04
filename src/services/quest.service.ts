import {
  GameEventType,
  QuestPeriod,
  UserQuestStatus,
  type Quest,
  type User,
  type UserQuest,
} from '@prisma/client';
import { questConfig } from '../config/game.config';
import { prisma, runInTransaction } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { endOfLocalDayUtc, endOfLocalWeekUtc, getDayKey, getWeekKey } from '../utils/time';
import { parseRewardBundle, rewardService, type RewardBundle } from './reward.service';
import type { QuestMetric } from '@prisma/client';

const log = childLogger('quest');

export type UserQuestWithQuest = UserQuest & { quest: Quest };

/** Deterministic hash so the same user gets the same quest set all period long. */
function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result);
}

function pickQuests(pool: Quest[], count: number, seed: string): Quest[] {
  if (pool.length <= count) return pool;
  const scored = pool
    .map((quest) => ({ quest, score: hash(`${seed}:${quest.code}`) / Math.max(1, quest.weight) }))
    .sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((entry) => entry.quest);
}

export const questService = {
  /** Returns the user's quests for the current periods, creating them if needed. */
  async getActiveQuests(user: User, now = new Date()): Promise<UserQuestWithQuest[]> {
    const dayKey = getDayKey(now, user.timezone);
    const weekKey = getWeekKey(now, user.timezone);

    await questService.assignForPeriod(user, QuestPeriod.DAILY, dayKey, endOfLocalDayUtc(now, user.timezone));
    await questService.assignForPeriod(user, QuestPeriod.WEEKLY, weekKey, endOfLocalWeekUtc(now, user.timezone));

    return prisma.userQuest.findMany({
      where: {
        userId: user.id,
        periodKey: { in: [dayKey, weekKey] },
        status: { not: UserQuestStatus.EXPIRED },
      },
      include: { quest: true },
      orderBy: [{ quest: { period: 'asc' } }, { createdAt: 'asc' }],
    });
  },

  async assignForPeriod(user: User, period: QuestPeriod, periodKey: string, expiresAt: Date): Promise<void> {
    const existing = await prisma.userQuest.count({
      where: { userId: user.id, periodKey, quest: { period } },
    });
    if (existing > 0) return;

    const pool = await prisma.quest.findMany({ where: { isActive: true, period } });
    if (!pool.length) return;

    const count = period === QuestPeriod.DAILY ? questConfig.dailyQuestCount : questConfig.weeklyQuestCount;
    const chosen = pickQuests(pool, count, `${user.id}:${periodKey}`);

    await prisma.userQuest.createMany({
      data: chosen.map((quest) => ({
        userId: user.id,
        questId: quest.id,
        periodKey,
        target: quest.target,
        expiresAt,
      })),
      skipDuplicates: true,
    });

    log.debug({ userId: user.id, period, periodKey, count: chosen.length }, 'quests assigned');
  },

  /**
   * Advances every active quest tracking `metric`.
   * Called from event subscribers, never from Telegram handlers.
   */
  async trackProgress(user: User, metric: QuestMetric, amount: number, now = new Date()): Promise<void> {
    if (amount <= 0) return;

    const dayKey = getDayKey(now, user.timezone);
    const weekKey = getWeekKey(now, user.timezone);

    const active = await prisma.userQuest.findMany({
      where: {
        userId: user.id,
        status: UserQuestStatus.ACTIVE,
        periodKey: { in: [dayKey, weekKey] },
        quest: { metric, isActive: true },
      },
      include: { quest: true },
    });

    for (const userQuest of active) {
      const progress = Math.min(userQuest.target, userQuest.progress + amount);
      const completed = progress >= userQuest.target;

      await prisma.userQuest.update({
        where: { id: userQuest.id },
        data: {
          progress,
          status: completed ? UserQuestStatus.COMPLETED : UserQuestStatus.ACTIVE,
          completedAt: completed ? now : null,
        },
      });

      await gameEvents.emit(GameEventType.QUEST_PROGRESS, {
        userId: user.id,
        userQuestId: userQuest.id,
        progress,
        target: userQuest.target,
      });

      if (completed) {
        await gameEvents.emit(GameEventType.QUEST_COMPLETED, {
          userId: user.id,
          userQuestId: userQuest.id,
          questCode: userQuest.quest.code,
        });
      }
    }
  },

  /** Claims a completed quest exactly once. */
  async claim(
    userId: string,
    userQuestId: string,
  ): Promise<{ ok: boolean; reason?: 'not_found' | 'not_completed' | 'already_claimed'; bundle?: RewardBundle }> {
    const claimed = await runInTransaction(async (tx) => {
      const userQuest = await tx.userQuest.findFirst({
        where: { id: userQuestId, userId },
        include: { quest: true },
      });

      if (!userQuest) return { ok: false as const, reason: 'not_found' as const };
      if (userQuest.status === UserQuestStatus.CLAIMED) {
        return { ok: false as const, reason: 'already_claimed' as const };
      }
      if (userQuest.status !== UserQuestStatus.COMPLETED) {
        return { ok: false as const, reason: 'not_completed' as const };
      }

      // Conditional update is the actual guard against double claims.
      const updated = await tx.userQuest.updateMany({
        where: { id: userQuestId, userId, status: UserQuestStatus.COMPLETED },
        data: { status: UserQuestStatus.CLAIMED, claimedAt: new Date() },
      });
      if (updated.count === 0) {
        return { ok: false as const, reason: 'already_claimed' as const };
      }

      const bundle = parseRewardBundle(userQuest.quest.reward);
      await rewardService.grantInTransaction(tx, {
        userId,
        bundle,
        reason: `quest_completed:${userQuest.quest.code}`,
        idempotencyKey: `quest_claim:${userQuestId}`,
      });

      return { ok: true as const, bundle };
    });

    if (claimed.ok) {
      await gameEvents.emit(GameEventType.QUEST_CLAIMED, { userId, userQuestId });
    }

    return claimed;
  },

  async expireOutdated(now = new Date()): Promise<number> {
    // Completed-but-unclaimed quests are intentionally left claimable forever.
    const result = await prisma.userQuest.updateMany({
      where: { expiresAt: { lt: now }, status: UserQuestStatus.ACTIVE },
      data: { status: UserQuestStatus.EXPIRED },
    });
    return result.count;
  },
};

import { GameEventType, WordStatus, type Achievement, type Prisma } from '@prisma/client';
import { isUniqueViolation, prisma, runInTransaction } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { parseRewardBundle, rewardService } from './reward.service';

const log = childLogger('achievement');

export const ACHIEVEMENT_METRICS = [
  'WORDS_STARTED',
  'WORDS_MASTERED',
  'TOTAL_ANSWERS',
  'TOTAL_CORRECT_ANSWERS',
  'CURRENT_STREAK',
  'LONGEST_STREAK',
  'TOTAL_XP',
  'LEVEL',
  'SESSIONS_COMPLETED',
  'DAILY_BONUS_STREAK',
  'EASTER_EGGS_FOUND',
] as const;

export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export interface AchievementCondition {
  metric: AchievementMetric;
  threshold: number;
}

export interface UserMetrics extends Record<AchievementMetric, number> {}

function parseCondition(value: Prisma.JsonValue): AchievementCondition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const metric = record.metric;
  const threshold = record.threshold;
  if (typeof metric !== 'string' || typeof threshold !== 'number') return null;
  if (!ACHIEVEMENT_METRICS.includes(metric as AchievementMetric)) return null;
  return { metric: metric as AchievementMetric, threshold };
}

export const achievementService = {
  async collectMetrics(userId: string): Promise<UserMetrics> {
    const [user, wordsStarted, wordsMastered, sessions, easterEggs] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          xp: true,
          level: true,
          currentStreak: true,
          longestStreak: true,
          totalAnswers: true,
          totalCorrectAnswers: true,
          dailyBonusStreak: true,
        },
      }),
      prisma.userWord.count({ where: { userId, status: { not: WordStatus.NEW } } }),
      prisma.userWord.count({ where: { userId, status: WordStatus.MASTERED } }),
      prisma.learningSession.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.userEasterEgg.count({ where: { userId } }),
    ]);

    return {
      WORDS_STARTED: wordsStarted,
      WORDS_MASTERED: wordsMastered,
      TOTAL_ANSWERS: user.totalAnswers,
      TOTAL_CORRECT_ANSWERS: user.totalCorrectAnswers,
      CURRENT_STREAK: user.currentStreak,
      LONGEST_STREAK: user.longestStreak,
      TOTAL_XP: user.xp,
      LEVEL: user.level,
      SESSIONS_COMPLETED: sessions,
      DAILY_BONUS_STREAK: user.dailyBonusStreak,
      EASTER_EGGS_FOUND: easterEggs,
    };
  },

  /**
   * Evaluates every achievement the user has not unlocked yet.
   * The unique constraint on (userId, achievementId) guarantees a single grant.
   */
  async evaluate(userId: string): Promise<Achievement[]> {
    const [achievements, unlocked] = await Promise.all([
      prisma.achievement.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
    ]);

    const unlockedIds = new Set(unlocked.map((entry) => entry.achievementId));
    const candidates = achievements.filter((achievement) => !unlockedIds.has(achievement.id));
    if (!candidates.length) return [];

    const metrics = await achievementService.collectMetrics(userId);
    const newlyUnlocked: Achievement[] = [];

    for (const achievement of candidates) {
      const condition = parseCondition(achievement.condition);
      if (!condition) {
        log.warn({ code: achievement.code }, 'achievement has an invalid condition, skipping');
        continue;
      }
      if (metrics[condition.metric] < condition.threshold) continue;

      const granted = await achievementService.unlock(userId, achievement);
      if (granted) newlyUnlocked.push(achievement);
    }

    return newlyUnlocked;
  },

  async unlock(userId: string, achievement: Achievement): Promise<boolean> {
    try {
      await runInTransaction(async (tx) => {
        await tx.userAchievement.create({ data: { userId, achievementId: achievement.id } });

        const bundle = parseRewardBundle(achievement.reward);
        await rewardService.grantInTransaction(tx, {
          userId,
          bundle,
          reason: `achievement:${achievement.code}`,
          idempotencyKey: `achievement:${userId}:${achievement.id}`,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }

    log.info({ userId, code: achievement.code }, 'achievement unlocked');
    await gameEvents.emit(GameEventType.ACHIEVEMENT_UNLOCKED, {
      userId,
      achievementCode: achievement.code,
      title: achievement.title,
      icon: achievement.icon,
    });
    return true;
  },

  async listForUser(userId: string) {
    const [achievements, unlocked] = await Promise.all([
      prisma.achievement.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.userAchievement.findMany({ where: { userId } }),
    ]);

    const unlockedMap = new Map(unlocked.map((entry) => [entry.achievementId, entry.unlockedAt]));

    return achievements.map((achievement) => ({
      achievement,
      unlockedAt: unlockedMap.get(achievement.id) ?? null,
      condition: parseCondition(achievement.condition),
    }));
  },
};

import { SessionStatus, WordStatus, type User } from '@prisma/client';
import { prisma } from '../db/prisma';
import { currentWeekDayKeys } from '../utils/time';

export interface ProgressStats {
  wordsTotal: number;
  wordsLearning: number;
  wordsFamiliar: number;
  wordsKnown: number;
  wordsMastered: number;
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  sessionsCompleted: number;
  learningMinutes: number;
  currentStreak: number;
  longestStreak: number;
  weekly: Array<{ dayKey: string; answers: number }>;
}

export const statsService = {
  async getProgress(user: User, now = new Date()): Promise<ProgressStats> {
    const weekKeys = currentWeekDayKeys(now, user.timezone);

    const [statusGroups, sessionsCompleted, weekActivity] = await Promise.all([
      prisma.userWord.groupBy({ by: ['status'], where: { userId: user.id }, _count: { _all: true } }),
      prisma.learningSession.count({ where: { userId: user.id, status: SessionStatus.COMPLETED } }),
      prisma.dailyActivity.findMany({ where: { userId: user.id, localDay: { in: weekKeys } } }),
    ]);

    const countFor = (status: WordStatus): number =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;

    const activityMap = new Map(weekActivity.map((entry) => [entry.localDay, entry.answers]));

    return {
      wordsTotal: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      wordsLearning: countFor(WordStatus.LEARNING),
      wordsFamiliar: countFor(WordStatus.FAMILIAR),
      wordsKnown: countFor(WordStatus.KNOWN),
      wordsMastered: countFor(WordStatus.MASTERED),
      totalAnswers: user.totalAnswers,
      correctAnswers: user.totalCorrectAnswers,
      accuracy: user.totalAnswers > 0 ? user.totalCorrectAnswers / user.totalAnswers : 0,
      sessionsCompleted,
      learningMinutes: Math.round(user.totalLearningSeconds / 60),
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      weekly: weekKeys.map((dayKey) => ({ dayKey, answers: activityMap.get(dayKey) ?? 0 })),
    };
  },

  async getAdminOverview() {
    const [users, activeToday, words, sessions, answers, gems] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastActiveAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.word.count({ where: { isActive: true } }),
      prisma.learningSession.count({ where: { status: SessionStatus.COMPLETED } }),
      prisma.learningAnswer.count(),
      prisma.user.aggregate({ _sum: { gems: true } }),
    ]);

    return {
      users,
      activeToday,
      words,
      sessions,
      answers,
      gems: gems._sum.gems ?? 0,
    };
  },
};

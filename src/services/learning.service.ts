import {
  AnswerGrade,
  ExerciseType,
  GameEventType,
  SessionStatus,
  WordStatus,
  type LearningSession,
  type User,
  type Word,
} from '@prisma/client';
import { gradeConfig, learningConfig, sessionRewardConfig } from '../config/game.config';
import { isUniqueViolation, prisma, runInTransaction } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { getDayKey } from '../utils/time';
import { buildExercise, selectExerciseType } from './exercise/exercise.factory';
import type { Exercise } from './exercise/exercise.types';
import { mergeBundles, rewardService, type RewardBundle } from './reward.service';
import { srs } from './srs';

const log = childLogger('learning');

export interface AnswerOutcome {
  accepted: boolean;
  reason?: 'session_finished' | 'stale_position' | 'session_not_found';
  isCorrect: boolean;
  becameMastered: boolean;
  correctAnswer: string;
  finished: boolean;
  nextExercise: Exercise | null;
}

export interface SessionSummary {
  sessionId: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  xpEarned: number;
  currencyEarned: number;
  masteredWords: number;
  perfect: boolean;
  firstSessionOfDay: boolean;
  alreadyCompleted: boolean;
}

async function pickSessionWords(user: User, now: Date, size: number): Promise<string[]> {
  const dueUserWords = await prisma.userWord.findMany({
    where: {
      userId: user.id,
      status: { not: WordStatus.MASTERED },
      nextReviewAt: { lte: now },
      word: { isActive: true, language: user.learningLanguage },
    },
    orderBy: [{ nextReviewAt: 'asc' }],
    take: size,
    select: { wordId: true },
  });

  const chosen = dueUserWords.map((entry) => entry.wordId);
  const remaining = size - chosen.length;
  if (remaining <= 0) return chosen;

  const newWords = await prisma.word.findMany({
    where: {
      isActive: true,
      language: user.learningLanguage,
      userWords: { none: { userId: user.id } },
    },
    orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(remaining, learningConfig.maxNewWordsPerSession),
    select: { id: true },
  });
  chosen.push(...newWords.map((word) => word.id));

  if (chosen.length >= size) return chosen.slice(0, size);

  // Nothing due and no new words left: top up with the weakest known words.
  const fillers = await prisma.userWord.findMany({
    where: {
      userId: user.id,
      wordId: { notIn: chosen.length ? chosen : undefined },
      word: { isActive: true, language: user.learningLanguage },
    },
    orderBy: [{ nextReviewAt: 'asc' }],
    take: size - chosen.length,
    select: { wordId: true },
  });
  chosen.push(...fillers.map((entry) => entry.wordId));

  return chosen.slice(0, size);
}

export const learningService = {
  /** Words that are due right now plus how many brand new ones are available. */
  async getSessionPreview(user: User, now = new Date()) {
    const [due, newAvailable, activeSession] = await Promise.all([
      prisma.userWord.count({
        where: {
          userId: user.id,
          status: { not: WordStatus.MASTERED },
          nextReviewAt: { lte: now },
          word: { isActive: true, language: user.learningLanguage },
        },
      }),
      prisma.word.count({
        where: { isActive: true, language: user.learningLanguage, userWords: { none: { userId: user.id } } },
      }),
      learningService.getActiveSession(user.id),
    ]);

    const plannedSize = Math.min(
      learningConfig.sessionSize,
      due + Math.min(newAvailable, learningConfig.maxNewWordsPerSession),
    );

    return {
      due,
      newAvailable,
      plannedSize,
      estimatedSeconds: plannedSize * learningConfig.estimatedSecondsPerCard,
      activeSession,
    };
  },

  async getActiveSession(userId: string): Promise<LearningSession | null> {
    return prisma.learningSession.findFirst({
      where: { userId, status: SessionStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
    });
  },

  /** Starts a session, or resumes the one already in progress. */
  async startSession(user: User, now = new Date()): Promise<{ session: LearningSession; resumed: boolean } | null> {
    const active = await learningService.getActiveSession(user.id);
    if (active) return { session: active, resumed: true };

    const wordIds = await pickSessionWords(user, now, learningConfig.sessionSize);
    if (!wordIds.length) return null;

    const session = await prisma.learningSession.create({
      data: {
        userId: user.id,
        plannedWordIds: wordIds,
        localDay: getDayKey(now, user.timezone),
      },
    });

    await gameEvents.emit(GameEventType.SESSION_STARTED, { userId: user.id, sessionId: session.id });
    return { session, resumed: false };
  },

  /** Builds the exercise for the session's current cursor position. */
  async getCurrentExercise(sessionId: string): Promise<Exercise | null> {
    const session = await prisma.learningSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== SessionStatus.IN_PROGRESS) return null;
    if (session.cursor >= session.plannedWordIds.length) return null;

    const wordId = session.plannedWordIds[session.cursor];
    if (!wordId) return null;

    const word = await prisma.word.findUnique({ where: { id: wordId } });
    if (!word) return null;

    const [userWord, distractors] = await Promise.all([
      prisma.userWord.findUnique({
        where: { userId_wordId: { userId: session.userId, wordId } },
        select: { learningLevel: true },
      }),
      prisma.word.findMany({
        where: { isActive: true, language: word.language, id: { not: wordId }, category: word.category },
        take: 24,
      }),
    ]);

    const pool = distractors.length >= learningConfig.multipleChoiceDistractors
      ? shuffle(distractors)
      : shuffle(
          await prisma.word.findMany({
            where: { isActive: true, language: word.language, id: { not: wordId } },
            take: 24,
          }),
        );

    const type = selectExerciseType(userWord?.learningLevel ?? 0, session.cursor);
    return buildExercise(type, word, pool, session.cursor, session.plannedWordIds.length);
  },

  /**
   * Records one answer.
   *
   * Idempotency: the answer is keyed by (sessionId, position). A replayed
   * callback for an already answered position is rejected without side effects.
   */
  async submitAnswer(
    user: User,
    sessionId: string,
    position: number,
    grade: AnswerGrade,
    exerciseType: ExerciseType,
    responseTimeMs?: number,
  ): Promise<AnswerOutcome> {
    const outcome = await runInTransaction(async (tx) => {
      const session = await tx.learningSession.findFirst({ where: { id: sessionId, userId: user.id } });
      if (!session) {
        return { accepted: false as const, reason: 'session_not_found' as const };
      }
      if (session.status !== SessionStatus.IN_PROGRESS) {
        return { accepted: false as const, reason: 'session_finished' as const };
      }
      if (session.cursor !== position) {
        return { accepted: false as const, reason: 'stale_position' as const };
      }

      const wordId = session.plannedWordIds[position];
      if (!wordId) {
        return { accepted: false as const, reason: 'stale_position' as const };
      }

      const word = await tx.word.findUniqueOrThrow({ where: { id: wordId } });
      const config = gradeConfig[grade];

      const existing = await tx.userWord.findUnique({
        where: { userId_wordId: { userId: user.id, wordId } },
      });

      const previousState = existing
        ? {
            learningLevel: existing.learningLevel,
            easeFactor: existing.easeFactor,
            interval: existing.interval,
            repetition: existing.repetition,
            lapses: existing.lapses,
            consecutiveCorrect: existing.consecutiveCorrect,
            consecutiveWrong: existing.consecutiveWrong,
            status: existing.status,
          }
        : srs.initialState();

      const review = srs.review(previousState, grade, new Date());

      await tx.userWord.upsert({
        where: { userId_wordId: { userId: user.id, wordId } },
        create: {
          userId: user.id,
          wordId,
          status: review.state.status,
          learningLevel: review.state.learningLevel,
          easeFactor: review.state.easeFactor,
          interval: review.state.interval,
          repetition: review.state.repetition,
          lapses: review.state.lapses,
          consecutiveCorrect: review.state.consecutiveCorrect,
          consecutiveWrong: review.state.consecutiveWrong,
          correctAnswers: config.isCorrect ? 1 : 0,
          wrongAnswers: config.isCorrect ? 0 : 1,
          lastReviewedAt: new Date(),
          nextReviewAt: review.nextReviewAt,
          masteredAt: review.becameMastered ? new Date() : null,
        },
        update: {
          status: review.state.status,
          learningLevel: review.state.learningLevel,
          easeFactor: review.state.easeFactor,
          interval: review.state.interval,
          repetition: review.state.repetition,
          lapses: review.state.lapses,
          consecutiveCorrect: review.state.consecutiveCorrect,
          consecutiveWrong: review.state.consecutiveWrong,
          correctAnswers: { increment: config.isCorrect ? 1 : 0 },
          wrongAnswers: { increment: config.isCorrect ? 0 : 1 },
          lastReviewedAt: new Date(),
          nextReviewAt: review.nextReviewAt,
          masteredAt: review.becameMastered ? new Date() : existing?.masteredAt ?? null,
        },
      });

      await tx.learningAnswer.create({
        data: {
          sessionId,
          userId: user.id,
          wordId,
          exerciseType,
          grade,
          isCorrect: config.isCorrect,
          responseTimeMs: responseTimeMs ?? null,
          position,
        },
      });

      const updatedSession = await tx.learningSession.update({
        where: { id: sessionId },
        data: {
          cursor: { increment: 1 },
          totalQuestions: { increment: 1 },
          correctAnswers: { increment: config.isCorrect ? 1 : 0 },
          wrongAnswers: { increment: config.isCorrect ? 0 : 1 },
          xpEarned: { increment: config.xp },
          currencyEarned: { increment: config.currency },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          totalAnswers: { increment: 1 },
          totalCorrectAnswers: { increment: config.isCorrect ? 1 : 0 },
          lastActiveAt: new Date(),
        },
      });

      return {
        accepted: true as const,
        isCorrect: config.isCorrect,
        becameMastered: review.becameMastered,
        correctAnswer: word.translation,
        status: review.state.status,
        wordId,
        finished: updatedSession.cursor >= updatedSession.plannedWordIds.length,
      };
    }).catch((error: unknown) => {
      // Duplicate (sessionId, position) means the update was replayed.
      if (isUniqueViolation(error)) return { accepted: false as const, reason: 'stale_position' as const };
      throw error;
    });

    if (!outcome.accepted) {
      return {
        accepted: false,
        reason: outcome.reason,
        isCorrect: false,
        becameMastered: false,
        correctAnswer: '',
        finished: outcome.reason === 'session_finished',
        nextExercise: null,
      };
    }

    await gameEvents.emit(GameEventType.WORD_ANSWERED, {
      userId: user.id,
      wordId: outcome.wordId,
      sessionId,
      grade,
      isCorrect: outcome.isCorrect,
      status: outcome.status,
    });

    if (outcome.becameMastered) {
      await gameEvents.emit(GameEventType.WORD_MASTERED, { userId: user.id, wordId: outcome.wordId });
    }

    const nextExercise = outcome.finished ? null : await learningService.getCurrentExercise(sessionId);

    return {
      accepted: true,
      isCorrect: outcome.isCorrect,
      becameMastered: outcome.becameMastered,
      correctAnswer: outcome.correctAnswer,
      finished: outcome.finished,
      nextExercise,
    };
  },

  /**
   * Finalises a session and pays out. Idempotent: the reward bundle uses the
   * session id as its key and the status flip is guarded by a conditional update.
   */
  async completeSession(user: User, sessionId: string, now = new Date()): Promise<SessionSummary | null> {
    const session = await prisma.learningSession.findFirst({ where: { id: sessionId, userId: user.id } });
    if (!session) return null;

    if (session.status === SessionStatus.COMPLETED) {
      return buildSummary(session, 0, false, true);
    }

    const localDay = getDayKey(now, user.timezone);
    const earlierToday = await prisma.learningSession.count({
      where: { userId: user.id, status: SessionStatus.COMPLETED, localDay },
    });
    const firstSessionOfDay = earlierToday === 0;

    const flipped = await prisma.learningSession.updateMany({
      where: { id: sessionId, userId: user.id, status: SessionStatus.IN_PROGRESS },
      data: { status: SessionStatus.COMPLETED, completedAt: now },
    });
    if (flipped.count === 0) {
      const fresh = await prisma.learningSession.findUniqueOrThrow({ where: { id: sessionId } });
      return buildSummary(fresh, 0, false, true);
    }

    const masteredWords = await prisma.learningAnswer.count({
      where: { sessionId, word: { userWords: { some: { userId: user.id, status: WordStatus.MASTERED } } } },
    });

    const perfect = session.totalQuestions > 0 && session.wrongAnswers === 0;

    const bundle: RewardBundle = mergeBundles(
      { xp: session.xpEarned, currency: session.currencyEarned },
      { xp: sessionRewardConfig.completionXp, currency: sessionRewardConfig.completionCurrency },
      perfect ? { xp: sessionRewardConfig.perfectBonusXp, currency: sessionRewardConfig.perfectBonusCurrency } : {},
      firstSessionOfDay
        ? { xp: sessionRewardConfig.firstSessionOfDayXp, currency: sessionRewardConfig.firstSessionOfDayCurrency }
        : {},
      masteredWords > 0
        ? {
            xp: masteredWords * sessionRewardConfig.wordMasteredXp,
            currency: masteredWords * sessionRewardConfig.wordMasteredCurrency,
          }
        : {},
    );

    const granted = await rewardService.grant({
      userId: user.id,
      bundle,
      reason: 'lesson_completed',
      idempotencyKey: `session_complete:${sessionId}`,
      metadata: { sessionId, perfect, firstSessionOfDay, masteredWords },
    });

    const durationSeconds = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalSessions: { increment: 1 },
        totalLearningSeconds: { increment: durationSeconds },
      },
    });

    await prisma.dailyActivity.upsert({
      where: { userId_localDay: { userId: user.id, localDay } },
      create: {
        userId: user.id,
        localDay,
        answers: session.totalQuestions,
        correct: session.correctAnswers,
        sessions: 1,
        xpEarned: granted.xp,
        seconds: durationSeconds,
      },
      update: {
        answers: { increment: session.totalQuestions },
        correct: { increment: session.correctAnswers },
        sessions: { increment: 1 },
        xpEarned: { increment: granted.xp },
        seconds: { increment: durationSeconds },
      },
    });

    log.info({ userId: user.id, sessionId, xp: granted.xp, currency: granted.currency }, 'session completed');

    await gameEvents.emit(GameEventType.SESSION_COMPLETED, {
      userId: user.id,
      sessionId,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      xpEarned: granted.xp,
    });

    return {
      sessionId,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      wrongAnswers: session.wrongAnswers,
      xpEarned: granted.xp,
      currencyEarned: granted.currency,
      masteredWords,
      perfect,
      firstSessionOfDay,
      alreadyCompleted: false,
    };
  },

  async abandonSession(userId: string, sessionId: string): Promise<void> {
    await prisma.learningSession.updateMany({
      where: { id: sessionId, userId, status: SessionStatus.IN_PROGRESS },
      data: { status: SessionStatus.ABANDONED, completedAt: new Date() },
    });
  },
};

function buildSummary(
  session: LearningSession,
  masteredWords: number,
  firstSessionOfDay: boolean,
  alreadyCompleted: boolean,
): SessionSummary {
  return {
    sessionId: session.id,
    totalQuestions: session.totalQuestions,
    correctAnswers: session.correctAnswers,
    wrongAnswers: session.wrongAnswers,
    xpEarned: session.xpEarned,
    currencyEarned: session.currencyEarned,
    masteredWords,
    perfect: session.totalQuestions > 0 && session.wrongAnswers === 0,
    firstSessionOfDay,
    alreadyCompleted,
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const a = copy[index];
    const b = copy[swap];
    if (a !== undefined && b !== undefined) {
      copy[index] = b;
      copy[swap] = a;
    }
  }
  return copy;
}

export type { Word };

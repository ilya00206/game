import type { AnswerGrade, WordStatus } from '@prisma/client';
import { learningConfig, srsConfig } from '../../config/game.config';
import { addDays, addMinutes } from '../../utils/time';
import type { SrsReview, SrsState, SrsStrategy } from './srs.types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function statusForLevel(level: number): WordStatus {
  for (const threshold of srsConfig.statusThresholds) {
    if (level >= threshold.minLevel) return threshold.status;
  }
  return 'NEW';
}

function intervalForLevel(level: number): number {
  const ladder = srsConfig.intervalLadderDays;
  if (level <= 0) return 0;
  if (level < ladder.length) return ladder[level] ?? 0;
  // Beyond the ladder keep multiplying the last step by the ease factor.
  return ladder[ladder.length - 1] ?? 0;
}

/**
 * Default strategy: a fixed interval ladder (0 → 1 → 3 → 7 → 14 → 30 → 60 days)
 * modulated by an SM-2 style ease factor. Deliberately forgiving: a wrong
 * answer drops two levels instead of resetting all progress.
 */
export const intervalLadderStrategy: SrsStrategy = {
  name: 'interval-ladder-v1',

  initialState(): SrsState {
    return {
      learningLevel: 0,
      easeFactor: 2.5,
      interval: 0,
      repetition: 0,
      lapses: 0,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      status: 'NEW',
    };
  },

  review(state: SrsState, grade: AnswerGrade, now: Date): SrsReview {
    const isCorrect = grade !== 'AGAIN';
    const maxLevel = srsConfig.intervalLadderDays.length - 1;

    const easeFactor = clamp(
      state.easeFactor + srsConfig.easeDelta[grade],
      srsConfig.minEaseFactor,
      srsConfig.maxEaseFactor,
    );

    const learningLevel = clamp(state.learningLevel + srsConfig.levelDelta[grade], 0, maxLevel);
    const repetition = isCorrect ? state.repetition + 1 : 0;
    const lapses = isCorrect ? state.lapses : state.lapses + 1;

    const baseInterval = intervalForLevel(learningLevel);
    const interval =
      learningLevel >= maxLevel && baseInterval > 0 ? Math.round(baseInterval * easeFactor) : baseInterval;

    const status = statusForLevel(learningLevel);
    const becameMastered =
      state.status !== 'MASTERED' &&
      status === 'MASTERED' &&
      repetition >= learningConfig.masteryRepetitions &&
      interval >= learningConfig.masteryIntervalDays;

    const nextReviewAt =
      interval <= 0 ? addMinutes(now, srsConfig.relearnDelayMinutes) : addDays(startOfDay(now), interval);

    return {
      state: {
        learningLevel,
        easeFactor,
        interval,
        repetition,
        lapses,
        consecutiveCorrect: isCorrect ? state.consecutiveCorrect + 1 : 0,
        consecutiveWrong: isCorrect ? 0 : state.consecutiveWrong + 1,
        status: becameMastered ? 'MASTERED' : status,
      },
      nextReviewAt,
      becameMastered,
    };
  },
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

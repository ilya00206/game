import type { AnswerGrade, WordStatus } from '@prisma/client';

/**
 * Single source of truth for every tunable game number.
 * Nothing in services or handlers may contain a bare numeric game constant.
 * This module is intentionally free of side effects and env access so that it
 * can be imported by unit tests directly.
 */

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

export const learningConfig = {
  /** How many cards a standard daily session contains. */
  sessionSize: 10,
  /** Upper bound of brand new words inside one session. */
  maxNewWordsPerSession: 4,
  /** Minimum answered cards that make a session count as daily activity. */
  minAnswersForDailyActivity: 5,
  /** Distractor count for multiple choice exercises (excluding the answer). */
  multipleChoiceDistractors: 3,
  /** Exercise types enabled in the MVP, in rotation order. */
  enabledExerciseTypes: ['FLASHCARD', 'MULTIPLE_CHOICE', 'REVERSE'] as const,
  /** A word must reach this many successful repetitions to become MASTERED. */
  masteryRepetitions: 6,
  /** Interval (days) at which a word is considered mastered. */
  masteryIntervalDays: 30,
  /** Estimated seconds per card, used for the "≈ N minutes" hint. */
  estimatedSecondsPerCard: 8,
} as const;

/**
 * Interval ladder (in days) used by the default SRS strategy.
 * Index === learningLevel. Replaceable by SM-2 / FSRS without touching callers.
 */
export const srsConfig = {
  intervalLadderDays: [0, 1, 3, 7, 14, 30, 60] as const,
  minEaseFactor: 1.3,
  maxEaseFactor: 3.0,
  easeDelta: {
    AGAIN: -0.2,
    HARD: -0.15,
    GOOD: 0,
    EASY: 0.15,
  } as Record<AnswerGrade, number>,
  /** Level movement per grade. */
  levelDelta: {
    AGAIN: -2,
    HARD: -1,
    GOOD: 1,
    EASY: 2,
  } as Record<AnswerGrade, number>,
  /** Minutes to wait before re-showing a word answered with AGAIN. */
  relearnDelayMinutes: 10,
  /** learningLevel -> status mapping thresholds. */
  statusThresholds: [
    { minLevel: 6, status: 'MASTERED' },
    { minLevel: 4, status: 'KNOWN' },
    { minLevel: 2, status: 'FAMILIAR' },
    { minLevel: 1, status: 'LEARNING' },
    { minLevel: 0, status: 'NEW' },
  ] as ReadonlyArray<{ minLevel: number; status: WordStatus }>,
} as const;

export const gradeConfig: Record<AnswerGrade, { isCorrect: boolean; gems: number; label: string }> = {
  AGAIN: { isCorrect: false, gems: 0, label: '😵 Не знаю' },
  HARD: { isCorrect: true, gems: 1, label: '🤔 Сложно' },
  GOOD: { isCorrect: true, gems: 1, label: '🙂 Знаю' },
  EASY: { isCorrect: true, gems: 1, label: '😍 Легко' },
};

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export const uiConfig = {
  progressBarLength: 10,
  progressBarFilled: '█',
  progressBarEmpty: '░',
  weeklyBarMaxLength: 10,
  itemsPerPage: 8,
} as const;

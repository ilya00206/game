import type { AnswerGrade, QuestMetric, WordStatus } from '@prisma/client';

/**
 * Single source of truth for every tunable game number.
 * Nothing in services or handlers may contain a bare numeric game constant.
 * This module is intentionally free of side effects and env access so that it
 * can be imported by unit tests directly.
 */

export interface RewardBundleConfig {
  currency?: number;
  xp?: number;
  streakShields?: number;
  items?: Array<{ code: string; quantity: number }>;
  achievementCode?: string;
  rewardCode?: string;
  message?: string;
}

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
  } satisfies Record<AnswerGrade, number>,
  /** Level movement per grade. */
  levelDelta: {
    AGAIN: -2,
    HARD: -1,
    GOOD: 1,
    EASY: 2,
  } satisfies Record<AnswerGrade, number>,
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

export const gradeConfig: Record<AnswerGrade, { isCorrect: boolean; xp: number; currency: number; label: string }> = {
  AGAIN: { isCorrect: false, xp: 1, currency: 0, label: '😵 Не знаю' },
  HARD: { isCorrect: true, xp: 3, currency: 1, label: '🤔 Сложно' },
  GOOD: { isCorrect: true, xp: 5, currency: 2, label: '🙂 Знаю' },
  EASY: { isCorrect: true, xp: 6, currency: 3, label: '😍 Легко' },
};

export const sessionRewardConfig = {
  /** Flat bonus for finishing a session. */
  completionXp: 20,
  completionCurrency: 15,
  /** Extra reward when every answer in the session was correct. */
  perfectBonusXp: 25,
  perfectBonusCurrency: 25,
  /** Bonus for the first completed session of the local day. */
  firstSessionOfDayXp: 15,
  firstSessionOfDayCurrency: 20,
  /** Reward for pushing a word into MASTERED. */
  wordMasteredXp: 15,
  wordMasteredCurrency: 10,
} as const;

// ---------------------------------------------------------------------------
// Levels / XP
// ---------------------------------------------------------------------------

export const levelConfig = {
  /** Cumulative XP required to reach level index + 1. */
  thresholds: [
    0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500,
    22000, 26000, 30500, 35500, 41000, 47000, 54000, 62000, 71000, 81000, 92000,
  ] as const,
  /** XP step added per level once the explicit table is exhausted. */
  overflowStep: 12000,
  /** Reward granted on every level up. */
  levelUpReward: { currency: 50, xp: 0 } satisfies RewardBundleConfig,
  /** Extra rewards on specific levels. */
  milestoneRewards: {
    5: { currency: 150, streakShields: 1 },
    10: { currency: 400, streakShields: 1 },
    20: { currency: 1000, streakShields: 2 },
    30: { currency: 2500, streakShields: 3 },
  } as Record<number, RewardBundleConfig>,
} as const;

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

export const streakConfig = {
  /** How many consecutive missed days a single shield can cover. */
  maxShieldedDays: 1,
  /** Streak length -> reward. */
  milestones: {
    3: { currency: 100, xp: 30 },
    7: { currency: 300, xp: 80, streakShields: 1 },
    14: { currency: 600, xp: 150, streakShields: 1 },
    30: { currency: 1500, xp: 400, streakShields: 2 },
    50: { currency: 2500, xp: 700, streakShields: 2 },
    100: { currency: 6000, xp: 1500, streakShields: 3 },
    365: { currency: 30000, xp: 10000, streakShields: 5 },
  } as Record<number, RewardBundleConfig>,
} as const;

// ---------------------------------------------------------------------------
// Daily bonus
// ---------------------------------------------------------------------------

export const dailyBonusConfig = {
  /** Cycle length; day 8 wraps back to day 1. */
  cycleLength: 7,
  /** Reward per day of the cycle (index 0 === day 1). */
  cycle: [
    { currency: 50, xp: 10 },
    { currency: 75, xp: 15 },
    { currency: 100, xp: 20 },
    { currency: 125, xp: 25 },
    { currency: 150, xp: 30 },
    { currency: 200, xp: 40 },
    { currency: 400, xp: 100, streakShields: 1 },
  ] as ReadonlyArray<RewardBundleConfig>,
} as const;

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export const questConfig = {
  dailyQuestCount: 3,
  weeklyQuestCount: 2,
} as const;

export const questMetricLabels: Record<QuestMetric, string> = {
  WORDS_ANSWERED: 'слов отвечено',
  CORRECT_ANSWERS: 'правильных ответов',
  WORDS_MASTERED: 'слов выучено',
  SESSIONS_COMPLETED: 'тренировок',
  XP_EARNED: 'XP',
  ACTIVE_DAYS: 'дней подряд',
  DAILY_BONUS_CLAIMED: 'бонусов',
};

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

export const economyConfig = {
  /** Hard ceiling for a single ledger operation; guards against bad configs. */
  maxSingleTransaction: 1_000_000,
  /** Balance can never go below this value. */
  minBalance: 0,
} as const;

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

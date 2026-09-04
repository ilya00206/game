import type { AnswerGrade, GameEventType, WordStatus } from '@prisma/client';

/** Payload shape for every game event. Keep additive to stay backwards safe. */
export interface GameEventPayloads {
  USER_REGISTERED: { userId: string };
  WORD_ANSWERED: {
    userId: string;
    wordId: string;
    sessionId: string;
    grade: AnswerGrade;
    isCorrect: boolean;
    status: WordStatus;
  };
  WORD_MASTERED: { userId: string; wordId: string };
  SESSION_STARTED: { userId: string; sessionId: string };
  SESSION_COMPLETED: {
    userId: string;
    sessionId: string;
    totalQuestions: number;
    correctAnswers: number;
    xpEarned: number;
  };
  DAILY_ACTIVITY_COMPLETED: { userId: string; localDay: string };
  STREAK_UPDATED: { userId: string; currentStreak: number; protectedByShield: boolean };
  STREAK_MILESTONE_REACHED: { userId: string; milestone: number };
  LEVEL_UP: { userId: string; fromLevel: number; toLevel: number };
  QUEST_PROGRESS: { userId: string; userQuestId: string; progress: number; target: number };
  QUEST_COMPLETED: { userId: string; userQuestId: string; questCode: string };
  QUEST_CLAIMED: { userId: string; userQuestId: string };
  ACHIEVEMENT_UNLOCKED: { userId: string; achievementCode: string; title: string; icon: string };
  DAILY_BONUS_CLAIMED: { userId: string; dayInCycle: number };
  SHOP_PURCHASE: { userId: string; itemCode: string; price: number };
  REWARD_GRANTED: { userId: string; reason: string };
  EASTER_EGG_FOUND: { userId: string; eggCode: string };
}

export type GameEvent = {
  [K in GameEventType]: { type: K; payload: GameEventPayloads[K]; at: Date };
}[GameEventType];

export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;

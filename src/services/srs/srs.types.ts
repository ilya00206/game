import type { AnswerGrade, WordStatus } from '@prisma/client';

/** Mutable SRS state of a single user/word pair. */
export interface SrsState {
  learningLevel: number;
  easeFactor: number;
  /** Days until the next review. */
  interval: number;
  repetition: number;
  lapses: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  status: WordStatus;
}

export interface SrsReview {
  state: SrsState;
  nextReviewAt: Date;
  becameMastered: boolean;
}

/**
 * Pluggable spaced repetition strategy.
 * Swapping the default ladder for SM-2 / FSRS only requires another
 * implementation of this interface — nothing else in the app changes.
 */
export interface SrsStrategy {
  readonly name: string;
  initialState(): SrsState;
  review(state: SrsState, grade: AnswerGrade, now: Date): SrsReview;
}

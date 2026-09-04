import type { ExerciseType, Word } from '@prisma/client';

export interface Exercise {
  type: ExerciseType;
  wordId: string;
  /** Prompt shown to the user (word or translation depending on the type). */
  prompt: string;
  /** The value that counts as a correct answer. */
  answer: string;
  hint?: string | undefined;
  example?: string | undefined;
  exampleTranslation?: string | undefined;
  pronunciation?: string | undefined;
  audioFileId?: string | undefined;
  /** Position inside the session queue; used for idempotent answering. */
  position: number;
  total: number;
}

export interface ExerciseBuilderContext {
  word: Word;
  position: number;
  total: number;
}

export interface ExerciseBuilder {
  readonly type: ExerciseType;
  /** Whether this builder can render the given word (e.g. needs an example). */
  supports(context: ExerciseBuilderContext): boolean;
  build(context: ExerciseBuilderContext): Exercise;
}

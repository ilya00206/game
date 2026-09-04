import { ExerciseType, type Word } from '@prisma/client';
import type { Exercise, ExerciseBuilder, ExerciseBuilderContext } from './exercise.types';

function baseFields(context: ExerciseBuilderContext) {
  const { word, position, total } = context;
  return {
    wordId: word.id,
    position,
    total,
    example: word.exampleSentence ?? undefined,
    exampleTranslation: word.exampleTranslation ?? undefined,
    pronunciation: word.pronunciation ?? undefined,
    audioFileId: word.audioFileId ?? undefined,
  };
}

export const flashcardBuilder: ExerciseBuilder = {
  type: ExerciseType.FLASHCARD,
  supports: () => true,
  build(context): Exercise {
    return {
      ...baseFields(context),
      type: ExerciseType.FLASHCARD,
      prompt: context.word.original,
      answer: context.word.translation,
    };
  },
};

export const translationBuilder: ExerciseBuilder = {
  type: ExerciseType.TRANSLATION,
  supports: () => true,
  build(context): Exercise {
    return {
      ...baseFields(context),
      type: ExerciseType.TRANSLATION,
      prompt: context.word.original,
      answer: context.word.translation,
      hint: context.word.translation.slice(0, 1),
    };
  },
};

const registry = new Map<ExerciseType, ExerciseBuilder>([
  [ExerciseType.FLASHCARD, flashcardBuilder],
  [ExerciseType.TRANSLATION, translationBuilder],
]);

/** Registering a new exercise type never requires touching the learning service. */
export function registerExerciseBuilder(builder: ExerciseBuilder): void {
  registry.set(builder.type, builder);
}

export function getExerciseBuilder(type: ExerciseType): ExerciseBuilder | undefined {
  return registry.get(type);
}

/** Only flashcards are enabled in the MVP, so every word gets that format. */
export function selectExerciseType(_learningLevel: number, _position: number): ExerciseType {
  return ExerciseType.FLASHCARD;
}

export function buildExercise(type: ExerciseType, word: Word, position: number, total: number): Exercise {
  const context: ExerciseBuilderContext = { word, position, total };
  const builder = registry.get(type);

  if (builder && builder.supports(context)) return builder.build(context);
  return flashcardBuilder.build(context);
}

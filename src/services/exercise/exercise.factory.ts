import { ExerciseType, type Word } from '@prisma/client';
import { learningConfig } from '../../config/game.config';
import type { Exercise, ExerciseBuilder, ExerciseBuilderContext, ExerciseOption } from './exercise.types';

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

function buildOptions(correct: Word, pool: Word[], project: (word: Word) => string): ExerciseOption[] {
  const distractors: Word[] = [];
  const seen = new Set([project(correct)]);

  for (const candidate of pool) {
    if (distractors.length >= learningConfig.multipleChoiceDistractors) break;
    const label = project(candidate);
    if (candidate.id === correct.id || seen.has(label)) continue;
    seen.add(label);
    distractors.push(candidate);
  }

  const options: ExerciseOption[] = [
    { id: correct.id, label: project(correct), isCorrect: true },
    ...distractors.map((word) => ({ id: word.id, label: project(word), isCorrect: false })),
  ];

  // Deterministic-enough shuffle; the correct answer must not always be first.
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const a = options[index];
    const b = options[swap];
    if (a && b) {
      options[index] = b;
      options[swap] = a;
    }
  }

  return options;
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

export const multipleChoiceBuilder: ExerciseBuilder = {
  type: ExerciseType.MULTIPLE_CHOICE,
  supports: (context) => context.distractorPool.length >= learningConfig.multipleChoiceDistractors,
  build(context): Exercise {
    return {
      ...baseFields(context),
      type: ExerciseType.MULTIPLE_CHOICE,
      prompt: context.word.original,
      answer: context.word.translation,
      options: buildOptions(context.word, context.distractorPool, (word) => word.translation),
    };
  },
};

export const reverseBuilder: ExerciseBuilder = {
  type: ExerciseType.REVERSE,
  supports: (context) => context.distractorPool.length >= learningConfig.multipleChoiceDistractors,
  build(context): Exercise {
    return {
      ...baseFields(context),
      type: ExerciseType.REVERSE,
      prompt: context.word.translation,
      answer: context.word.original,
      options: buildOptions(context.word, context.distractorPool, (word) => word.original),
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
  [ExerciseType.MULTIPLE_CHOICE, multipleChoiceBuilder],
  [ExerciseType.REVERSE, reverseBuilder],
  [ExerciseType.TRANSLATION, translationBuilder],
]);

/** Registering a new exercise type never requires touching the learning service. */
export function registerExerciseBuilder(builder: ExerciseBuilder): void {
  registry.set(builder.type, builder);
}

export function getExerciseBuilder(type: ExerciseType): ExerciseBuilder | undefined {
  return registry.get(type);
}

/**
 * Picks the exercise type for a word: brand new words are always shown as a
 * flashcard first, familiar words get harder formats.
 */
export function selectExerciseType(learningLevel: number, position: number): ExerciseType {
  if (learningLevel <= 0) return ExerciseType.FLASHCARD;

  const enabled = learningConfig.enabledExerciseTypes;
  const index = (position + learningLevel) % enabled.length;
  return (enabled[index] ?? ExerciseType.FLASHCARD) as ExerciseType;
}

export function buildExercise(
  type: ExerciseType,
  word: Word,
  distractorPool: Word[],
  position: number,
  total: number,
): Exercise {
  const context: ExerciseBuilderContext = { word, distractorPool, position, total };
  const builder = registry.get(type);

  if (builder && builder.supports(context)) return builder.build(context);
  return flashcardBuilder.build(context);
}

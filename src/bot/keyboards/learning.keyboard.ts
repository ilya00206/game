import { AnswerGrade, ExerciseType } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { gradeConfig } from '../../config/game.config';
import type { Exercise } from '../../services/exercise/exercise.types';
import { CB, cb } from '../callback-data';

const GRADE_ORDER: AnswerGrade[] = [AnswerGrade.AGAIN, AnswerGrade.HARD, AnswerGrade.GOOD, AnswerGrade.EASY];

export function sessionPreviewKeyboard(hasWords: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (hasWords) keyboard.text('▶️ Начать', cb(CB.learn, 'go')).row();
  return keyboard.text('⬅️ В меню', cb(CB.menu, 'main'));
}

/** Flashcard front side: only the reveal button. */
export function revealKeyboard(sessionId: string, position: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('👀 Показать перевод', cb(CB.learn, 'show', sessionId, position))
    .row()
    .text('⏹ Завершить', cb(CB.learn, 'stop', sessionId));
}

/** Flashcard back side: self assessment. */
export function gradeKeyboard(sessionId: string, position: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  GRADE_ORDER.forEach((grade, index) => {
    keyboard.text(gradeConfig[grade].label, cb(CB.learn, 'ans', sessionId, position, grade));
    if (index === 1) keyboard.row();
  });
  return keyboard.row().text('⏹ Завершить', cb(CB.learn, 'stop', sessionId));
}

/** Multiple choice / reverse: one button per option, index only in the payload. */
export function choiceKeyboard(exercise: Exercise, sessionId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  (exercise.options ?? []).forEach((option, index) => {
    keyboard.text(option.label, cb(CB.learn, 'pick', sessionId, exercise.position, index)).row();
  });
  return keyboard.text('⏹ Завершить', cb(CB.learn, 'stop', sessionId));
}

export function exerciseKeyboard(exercise: Exercise, sessionId: string): InlineKeyboard {
  if (exercise.type === ExerciseType.MULTIPLE_CHOICE || exercise.type === ExerciseType.REVERSE) {
    return choiceKeyboard(exercise, sessionId);
  }
  return revealKeyboard(sessionId, exercise.position);
}

export function continueKeyboard(sessionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('➡️ Дальше', cb(CB.learn, 'next', sessionId))
    .row()
    .text('⏹ Завершить', cb(CB.learn, 'stop', sessionId));
}

export function summaryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔁 Ещё тренировка', cb(CB.learn, 'start'))
    .row()
    .text('🎯 Задания', cb(CB.quests, 'list'))
    .text('⬅️ В меню', cb(CB.menu, 'main'));
}

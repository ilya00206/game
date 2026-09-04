import { AnswerGrade } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import type { Exercise } from '../../services/exercise/exercise.types';
import { CB, cb } from '../callback-data';

export function sessionPreviewKeyboard(hasWords: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (hasWords) keyboard.text('▶️ Начать', cb(CB.learn, 'go')).row();
  return keyboard.text('⬅️ В меню', cb(CB.menu, 'main'));
}

/** Flashcard: know it (submits GOOD and moves on) or don't (reveals the answer first). */
export function flashcardKeyboard(sessionId: string, position: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Знаю', cb(CB.learn, 'ans', sessionId, position, AnswerGrade.GOOD))
    .text('❌ Не знаю', cb(CB.learn, 'dontknow', sessionId, position))
    .row()
    .text('⏹ Завершить', cb(CB.learn, 'stop', sessionId));
}

export function exerciseKeyboard(exercise: Exercise, sessionId: string): InlineKeyboard {
  return flashcardKeyboard(sessionId, exercise.position);
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
    .text('⬅️ В меню', cb(CB.menu, 'main'));
}

import { AnswerGrade, ExerciseType } from '@prisma/client';
import { Composer } from 'grammy';
import { learningConfig } from '../../config/game.config';
import { drainNotices } from '../../events/notice-buffer';
import type { Exercise } from '../../services/exercise/exercise.types';
import { learningService } from '../../services/learning.service';
import { streakService } from '../../services/streak.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { CURRENCY, escapeHtml, formatPercent, pluralRu, progressBar } from '../format';
import {
  continueKeyboard,
  exerciseKeyboard,
  gradeKeyboard,
  sessionPreviewKeyboard,
  summaryKeyboard,
} from '../keyboards/learning.keyboard';
import { ack, render } from '../render';
import { renderMainMenu } from './menu.handler';

export const learningComposer = new Composer<BotContext>();

const GRADES = new Set<string>(Object.values(AnswerGrade));

function exerciseHeader(exercise: Exercise): string {
  return `📚 <b>Карточка ${exercise.position + 1}/${exercise.total}</b>   ${progressBar(
    exercise.position / Math.max(1, exercise.total),
    exercise.total > 10 ? 10 : exercise.total,
  )}`;
}

function renderExerciseText(exercise: Exercise): string {
  const lines = [exerciseHeader(exercise), ''];

  if (exercise.type === ExerciseType.REVERSE) {
    lines.push(`Как будет «<b>${escapeHtml(exercise.prompt)}</b>»?`);
  } else if (exercise.type === ExerciseType.MULTIPLE_CHOICE) {
    lines.push(`<b>${escapeHtml(exercise.prompt)}</b>`, '', 'Что это значит?');
  } else {
    lines.push(`<b>${escapeHtml(exercise.prompt)}</b>`);
    if (exercise.pronunciation) lines.push(`<i>[${escapeHtml(exercise.pronunciation)}]</i>`);
  }

  return lines.join('\n');
}

function renderRevealedText(exercise: Exercise): string {
  const lines = [
    exerciseHeader(exercise),
    '',
    `<b>${escapeHtml(exercise.prompt)}</b>`,
    exercise.pronunciation ? `<i>[${escapeHtml(exercise.pronunciation)}]</i>` : '',
    '',
    `➡️ ${escapeHtml(exercise.answer)}`,
  ];

  if (exercise.example) {
    lines.push('', `💬 ${escapeHtml(exercise.example)}`);
    if (exercise.exampleTranslation) lines.push(`   <i>${escapeHtml(exercise.exampleTranslation)}</i>`);
  }

  lines.push('', 'Насколько было легко?');
  return lines.filter((line) => line !== '').join('\n');
}

async function showExercise(ctx: BotContext, sessionId: string, exercise: Exercise): Promise<void> {
  ctx.session.exerciseShownAt = Date.now();
  await render(ctx, renderExerciseText(exercise), { keyboard: exerciseKeyboard(exercise, sessionId) });
}

async function showSummary(ctx: BotContext, sessionId: string): Promise<void> {
  const summary = await learningService.completeSession(ctx.user, sessionId);
  if (!summary) {
    await renderMainMenu(ctx);
    return;
  }

  const streak = await streakService.registerActivity(ctx.user);
  const notices = drainNotices(ctx.user.id);

  const accuracy = summary.totalQuestions > 0 ? summary.correctAnswers / summary.totalQuestions : 0;

  const lines = [
    '🎉 <b>Тренировка завершена!</b>',
    '',
    `${summary.correctAnswers}/${summary.totalQuestions} правильных   (${formatPercent(accuracy)})`,
    summary.wrongAnswers > 0 ? `🔁 ${summary.wrongAnswers} ${pluralRu(summary.wrongAnswers, ['слово требует', 'слова требуют', 'слов требуют'])} повторения` : '✨ Ни одной ошибки!',
    '',
    `+${summary.xpEarned} XP`,
    `+${summary.currencyEarned} ${CURRENCY}`,
    summary.masteredWords > 0 ? `🌟 Выучено полностью: ${summary.masteredWords}` : '',
    '',
    streak.changed
      ? `🔥 Streak: ${streak.currentStreak} ${pluralRu(streak.currentStreak, ['день', 'дня', 'дней'])}${
          streak.protectedByShield ? ' (щит спас серию 🛡)' : ''
        }`
      : `🔥 Streak: ${ctx.user.currentStreak} — уже отмечен сегодня`,
  ];

  if (notices.length) {
    lines.push('', ...notices.map((notice) => `${notice.icon} ${notice.text}`));
  }

  await render(ctx, lines.filter(Boolean).join('\n'), { keyboard: summaryKeyboard() });
}

async function advance(ctx: BotContext, sessionId: string, nextExercise: Exercise | null): Promise<void> {
  if (nextExercise) {
    await showExercise(ctx, sessionId, nextExercise);
    return;
  }
  await showSummary(ctx, sessionId);
}

learningComposer.callbackQuery(cb(CB.learn, 'start'), async (ctx) => {
  await ack(ctx);

  const preview = await learningService.getSessionPreview(ctx.user);

  if (preview.activeSession) {
    const exercise = await learningService.getCurrentExercise(preview.activeSession.id);
    if (exercise) {
      await showExercise(ctx, preview.activeSession.id, exercise);
      return;
    }
    await showSummary(ctx, preview.activeSession.id);
    return;
  }

  if (preview.plannedSize === 0) {
    await render(
      ctx,
      [
        '🌙 <b>Всё повторено</b>',
        '',
        'Новых слов пока нет, а все карточки на сегодня уже сделаны.',
        'Загляни завтра — streak сохранится.',
      ].join('\n'),
      { keyboard: sessionPreviewKeyboard(false) },
    );
    return;
  }

  const minutes = Math.max(1, Math.round(preview.estimatedSeconds / 60));

  await render(
    ctx,
    [
      '🌸 <b>Сегодняшняя тренировка</b>',
      '',
      `${preview.plannedSize} ${pluralRu(preview.plannedSize, ['карточка', 'карточки', 'карточек'])}`,
      `≈ ${minutes} ${pluralRu(minutes, ['минута', 'минуты', 'минут'])}`,
      '',
      `🔁 К повторению: ${preview.due}`,
      `✨ Новых слов: ${Math.min(preview.newAvailable, learningConfig.maxNewWordsPerSession)}`,
      '',
      'Награды: XP, кристаллы, прогресс заданий и streak.',
    ].join('\n'),
    { keyboard: sessionPreviewKeyboard(true) },
  );
});

learningComposer.callbackQuery(cb(CB.learn, 'go'), async (ctx) => {
  await ack(ctx);

  const started = await learningService.startSession(ctx.user);
  if (!started) {
    await render(ctx, '🌙 Пока нечего учить. Загляни позже.', { keyboard: sessionPreviewKeyboard(false) });
    return;
  }

  const exercise = await learningService.getCurrentExercise(started.session.id);
  if (!exercise) {
    await showSummary(ctx, started.session.id);
    return;
  }

  await showExercise(ctx, started.session.id, exercise);
});

// Flashcard: reveal the translation, then ask for a self assessment.
learningComposer.callbackQuery(/^learn:show:([^:]+):(\d+)$/, async (ctx) => {
  await ack(ctx);
  const sessionId = ctx.match[1];
  const position = Number(ctx.match[2]);
  if (!sessionId) return;

  const exercise = await learningService.getCurrentExercise(sessionId);
  if (!exercise || exercise.position !== position) {
    await ack(ctx, 'Карточка уже пройдена');
    return;
  }

  await render(ctx, renderRevealedText(exercise), { keyboard: gradeKeyboard(sessionId, position) });
});

// Flashcard grading.
learningComposer.callbackQuery(/^learn:ans:([^:]+):(\d+):([A-Z]+)$/, async (ctx) => {
  const sessionId = ctx.match[1];
  const position = Number(ctx.match[2]);
  const grade = ctx.match[3];
  if (!sessionId || !grade || !GRADES.has(grade)) {
    await ack(ctx);
    return;
  }

  const responseTime = ctx.session.exerciseShownAt ? Date.now() - ctx.session.exerciseShownAt : undefined;

  const outcome = await learningService.submitAnswer(
    ctx.user,
    sessionId,
    position,
    grade as AnswerGrade,
    ExerciseType.FLASHCARD,
    responseTime,
  );

  if (!outcome.accepted) {
    await ack(ctx, outcome.reason === 'stale_position' ? 'Уже отвечено' : 'Тренировка завершена');
    if (outcome.reason === 'session_finished') await showSummary(ctx, sessionId);
    return;
  }

  await ack(ctx, outcome.becameMastered ? '🌟 Слово выучено!' : undefined);
  await advance(ctx, sessionId, outcome.nextExercise);
});

// Multiple choice / reverse: the payload carries only the option index.
learningComposer.callbackQuery(/^learn:pick:([^:]+):(\d+):(\d+)$/, async (ctx) => {
  const sessionId = ctx.match[1];
  const position = Number(ctx.match[2]);
  const optionIndex = Number(ctx.match[3]);
  if (!sessionId) {
    await ack(ctx);
    return;
  }

  const exercise = await learningService.getCurrentExercise(sessionId);
  if (!exercise || exercise.position !== position) {
    await ack(ctx, 'Уже отвечено');
    return;
  }

  const option = exercise.options?.[optionIndex];
  if (!option) {
    await ack(ctx);
    return;
  }

  const responseTime = ctx.session.exerciseShownAt ? Date.now() - ctx.session.exerciseShownAt : undefined;
  const grade = option.isCorrect ? AnswerGrade.GOOD : AnswerGrade.AGAIN;

  const outcome = await learningService.submitAnswer(
    ctx.user,
    sessionId,
    position,
    grade,
    exercise.type,
    responseTime,
  );

  if (!outcome.accepted) {
    await ack(ctx, 'Уже отвечено');
    return;
  }

  await ack(ctx, option.isCorrect ? '✅ Верно!' : '❌ Не совсем');

  const feedback = [
    option.isCorrect ? '✅ <b>Верно!</b>' : '❌ <b>Не совсем</b>',
    '',
    `<b>${escapeHtml(exercise.prompt)}</b> → ${escapeHtml(exercise.answer)}`,
    exercise.example ? `\n💬 ${escapeHtml(exercise.example)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (outcome.finished) {
    await showSummary(ctx, sessionId);
    return;
  }

  await render(ctx, feedback, { keyboard: continueKeyboard(sessionId) });
});

learningComposer.callbackQuery(/^learn:next:([^:]+)$/, async (ctx) => {
  await ack(ctx);
  const sessionId = ctx.match[1];
  if (!sessionId) return;

  const exercise = await learningService.getCurrentExercise(sessionId);
  await advance(ctx, sessionId, exercise);
});

learningComposer.callbackQuery(/^learn:stop:([^:]+)$/, async (ctx) => {
  await ack(ctx);
  const sessionId = ctx.match[1];
  if (!sessionId) return;

  const session = await learningService.getActiveSession(ctx.user.id);
  if (session && session.id === sessionId && session.totalQuestions >= learningConfig.minAnswersForDailyActivity) {
    await showSummary(ctx, sessionId);
    return;
  }

  await learningService.abandonSession(ctx.user.id, sessionId);
  await renderMainMenu(ctx);
});

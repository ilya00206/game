import { AnswerGrade, ExerciseType } from '@prisma/client';
import { Composer, InlineKeyboard } from 'grammy';
import { learningConfig } from '../../config/game.config';
import type { Exercise } from '../../services/exercise/exercise.types';
import { learningService } from '../../services/learning.service';
import { streakService } from '../../services/streak.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { CURRENCY, escapeHtml, formatPercent, pluralRu, progressBar } from '../format';
import {
  continueKeyboard,
  exerciseKeyboard,
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
  const lines = [exerciseHeader(exercise), '', `<b>${escapeHtml(exercise.prompt)}</b>`];
  return lines.join('\n');
}

function renderAnswerRevealText(exercise: Exercise): string {
  const lines = [
    exerciseHeader(exercise),
    '',
    `<b>${escapeHtml(exercise.prompt)}</b>`,
    `➡️ ${escapeHtml(exercise.answer)}`,
  ];

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

  const accuracy = summary.totalQuestions > 0 ? summary.correctAnswers / summary.totalQuestions : 0;

  const lines = [
    '🎉 <b>Тренировка завершена!</b>',
    '',
    `${summary.correctAnswers}/${summary.totalQuestions} правильных   (${formatPercent(accuracy)})`,
    summary.wrongAnswers > 0 ? `🔁 ${summary.wrongAnswers} ${pluralRu(summary.wrongAnswers, ['слово требует', 'слова требуют', 'слов требуют'])} повторения` : '✨ Ни одной ошибки!',
    '',
    `+${summary.gemsEarned} ${CURRENCY}`,
    summary.masteredWords > 0 ? `🌟 Выучено полностью: ${summary.masteredWords}` : '',
    '',
    streak.changed ? `🔥 Streak: ${streak.currentStreak} ${pluralRu(streak.currentStreak, ['день', 'дня', 'дней'])}` : '',
  ];

  await render(ctx, lines.filter(Boolean).join('\n'), { keyboard: summaryKeyboard() });
}

async function advance(ctx: BotContext, sessionId: string, nextExercise: Exercise | null): Promise<void> {
  if (nextExercise) {
    await showExercise(ctx, sessionId, nextExercise);
    return;
  }
  await showSummary(ctx, sessionId);
}

async function startSelectedSession(ctx: BotContext): Promise<void> {
  const started = await learningService.startSession(ctx.user, ctx.session.learningGroupId);
  if (!started) {
    await render(ctx, '🌙 В выбранной группе пока нет карточек.', { keyboard: sessionPreviewKeyboard(false) });
    return;
  }

  const exercise = await learningService.getCurrentExercise(started.session.id);
  if (!exercise) {
    await showSummary(ctx, started.session.id);
    return;
  }

  await showExercise(ctx, started.session.id, exercise);
}

learningComposer.callbackQuery(cb(CB.learn, 'start'), async (ctx) => {
  await ack(ctx);

  const preview = await learningService.getSessionPreview(ctx.user, ctx.session.learningGroupId);
  if (preview.activeSession) {
    const exercise = await learningService.getCurrentExercise(preview.activeSession.id);
    if (exercise) {
      await showExercise(ctx, preview.activeSession.id, exercise);
      return;
    }
    await showSummary(ctx, preview.activeSession.id);
    return;
  }

  const groups = await learningService.getGroups(ctx.user);
  const keyboard = new InlineKeyboard()
    .text('🎲 Все группы', cb(CB.learn, 'group', 'all'))
    .row();
  for (const group of groups) keyboard.text(group.name, cb(CB.learn, 'group', group.id)).row();
  keyboard.text('⬅️ В меню', cb(CB.menu, 'main'));
  await render(ctx, '📚 <b>Выбери группу слов</b>', { keyboard });
});

learningComposer.callbackQuery(cb(CB.learn, 'add'), async (ctx) => {
  await ack(ctx);
  const groups = await learningService.getGroups(ctx.user);
  const keyboard = new InlineKeyboard().text('➕ Новая группа', cb(CB.learn, 'newgroup')).row();
  for (const group of groups) keyboard.text(group.name, cb(CB.learn, 'addgroup', group.id)).row();
  keyboard.text('⬅️ В меню', cb(CB.menu, 'main'));
  await render(ctx, '➕ <b>Добавить слово</b>\n\nВыбери группу:', { keyboard });
});

learningComposer.callbackQuery(cb(CB.learn, 'newgroup'), async (ctx) => {
  await ack(ctx);
  ctx.session.wordEntry = { step: 'groupName' };
  await render(ctx, '➕ <b>Новая группа</b>\n\nНапиши название группы:', {
    keyboard: new InlineKeyboard().text('✖️ Отмена', cb(CB.menu, 'main')),
  });
});

learningComposer.callbackQuery(/^learn:addgroup:(.+)$/, async (ctx) => {
  await ack(ctx);
  const groupId = ctx.match[1];
  if (!groupId) return;

  const groups = await learningService.getGroups(ctx.user);
  if (!groups.some((group) => group.id === groupId)) {
    await ack(ctx, 'Группа не найдена', true);
    return;
  }

  ctx.session.wordEntry = { step: 'original', groupId };
  await render(ctx, '➕ <b>Добавить слово</b>\n\nНапиши польское слово:', {
    keyboard: new InlineKeyboard().text('✖️ Отмена', cb(CB.menu, 'main')),
  });
});

learningComposer.callbackQuery(/^learn:group:(.+)$/, async (ctx) => {
  await ack(ctx);
  const groupId = ctx.match[1];
  if (!groupId) return;

  if (groupId === 'all') {
    ctx.session.learningGroupId = undefined;
  } else {
    const groups = await learningService.getGroups(ctx.user);
    if (!groups.some((group) => group.id === groupId)) {
      await ack(ctx, 'Группа не найдена', true);
      return;
    }
    ctx.session.learningGroupId = groupId;
  }

  await startSelectedSession(ctx);
});

learningComposer.callbackQuery(cb(CB.learn, 'go'), async (ctx) => {
  await ack(ctx);
  await startSelectedSession(ctx);
});

// Flashcard: "don't know" submits AGAIN and reveals the translation before advancing.
learningComposer.callbackQuery(/^learn:dontknow:([^:]+):(\d+)$/, async (ctx) => {
  const sessionId = ctx.match[1];
  const position = Number(ctx.match[2]);
  if (!sessionId) {
    await ack(ctx);
    return;
  }

  const exercise = await learningService.getCurrentExercise(sessionId);
  if (!exercise || exercise.position !== position) {
    await ack(ctx, 'Карточка уже пройдена');
    return;
  }

  const responseTime = ctx.session.exerciseShownAt ? Date.now() - ctx.session.exerciseShownAt : undefined;

  const outcome = await learningService.submitAnswer(
    ctx.user,
    sessionId,
    position,
    AnswerGrade.AGAIN,
    ExerciseType.FLASHCARD,
    responseTime,
  );

  if (!outcome.accepted) {
    await ack(ctx, outcome.reason === 'stale_position' ? 'Уже отвечено' : 'Тренировка завершена');
    if (outcome.reason === 'session_finished') await showSummary(ctx, sessionId);
    return;
  }

  await ack(ctx);
  await render(ctx, renderAnswerRevealText(exercise), { keyboard: continueKeyboard(sessionId) });
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

learningComposer.on('message:text', async (ctx, next) => {
  const entry = ctx.session.wordEntry;
  if (!entry) {
    await next();
    return;
  }

  const text = ctx.message.text.trim();
  if (entry.step === 'groupName') {
    if (!text || text.length > 100) {
      await ctx.reply('Название группы должно содержать от 1 до 100 символов.');
      return;
    }
    const group = await learningService.createGroup(text);
    ctx.session.wordEntry = { step: 'original', groupId: group.id };
    await ctx.reply('Напиши польское слово:', {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('✖️ Отмена', cb(CB.menu, 'main')),
    });
    return;
  }

  if (entry.step === 'original') {
    if (!text || text.length > 200 || !entry.groupId) {
      await ctx.reply('Польское слово должно содержать от 1 до 200 символов.');
      return;
    }
    ctx.session.wordEntry = { step: 'translation', groupId: entry.groupId, original: text };
    await ctx.reply('Теперь напиши русский перевод:');
    return;
  }

  if (!text || text.length > 200 || !entry.groupId || !entry.original) {
    await ctx.reply('Русский перевод должен содержать от 1 до 200 символов.');
    return;
  }

  const word = await learningService.addWordToGroup(entry.groupId, entry.original, text);
  ctx.session.wordEntry = undefined;
  await ctx.reply(`✅ Добавлено: <b>${escapeHtml(word.original)}</b> — ${escapeHtml(word.translation)}`, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text('➕ Добавить ещё', cb(CB.learn, 'add')).row().text('⬅️ В меню', cb(CB.menu, 'main')),
  });
});

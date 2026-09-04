import { Composer } from 'grammy';
import { statsService } from '../../services/stats.service';
import { streakService } from '../../services/streak.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { CURRENCY, barForValue, escapeHtml, formatDuration, formatPercent, weekdayLabel } from '../format';
import { backToMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';

export const profileComposer = new Composer<BotContext>();

async function renderProfile(ctx: BotContext): Promise<void> {
  const stats = await statsService.getProgress(ctx.user);

  const lines = [
    `👤 <b>${escapeHtml(ctx.user.firstName ?? 'Профиль')}</b>`,
    '',
    `🔥 Streak: ${stats.currentStreak}`,
    `🏆 Лучший streak: ${stats.longestStreak}`,
    '',
    `📚 Слов в работе: ${stats.wordsTotal}`,
    `🌟 Выучено полностью: ${stats.wordsMastered}`,
    `🎯 Правильных ответов: ${stats.correctAnswers}`,
    '',
    `☀️ Солнышки: ${ctx.user.gems} ${CURRENCY}`,
  ];

  await render(ctx, lines.filter(Boolean).join('\n'), { keyboard: backToMenuKeyboard() });
}

async function renderProgress(ctx: BotContext): Promise<void> {
  const stats = await statsService.getProgress(ctx.user);
  const maxAnswers = Math.max(1, ...stats.weekly.map((entry) => entry.answers));

  const weekly = stats.weekly
    .map((entry, index) => `${weekdayLabel(index)}  ${barForValue(entry.answers, maxAnswers)} ${entry.answers || ''}`)
    .join('\n');

  const lines = [
    '📊 <b>Прогресс</b>',
    '',
    `📚 Всего слов: ${stats.wordsTotal}`,
    `   • изучаются: ${stats.wordsLearning}`,
    `   • знакомые: ${stats.wordsFamiliar}`,
    `   • знаю: ${stats.wordsKnown}`,
    `   • выучено: ${stats.wordsMastered}`,
    '',
    `🎯 Точность: ${formatPercent(stats.accuracy)} (${stats.correctAnswers}/${stats.totalAnswers})`,
    `🏁 Тренировок: ${stats.sessionsCompleted}`,
    `⏱ Время в игре: ${formatDuration(stats.learningMinutes * 60)}`,
    '<b>Эта неделя</b>',
    weekly,
  ];

  await render(ctx, lines.join('\n'), { keyboard: backToMenuKeyboard() });
}

profileComposer.callbackQuery(cb(CB.profile, 'open'), async (ctx) => {
  await ack(ctx);
  await renderProfile(ctx);
});

profileComposer.callbackQuery(cb(CB.progress, 'open'), async (ctx) => {
  await ack(ctx);
  await renderProgress(ctx);
});

profileComposer.command('stats', async (ctx) => {
  await renderProgress(ctx);
});

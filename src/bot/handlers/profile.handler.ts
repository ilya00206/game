import { Composer } from 'grammy';
import { easterEggService } from '../../services/easterEgg.service';
import { statsService } from '../../services/stats.service';
import { streakService } from '../../services/streak.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { CURRENCY, barForValue, escapeHtml, formatDuration, formatPercent, progressBar, weekdayLabel } from '../format';
import { backToMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';

export const profileComposer = new Composer<BotContext>();

async function renderProfile(ctx: BotContext): Promise<void> {
  const stats = await statsService.getProgress(ctx.user);
  const eggs = await easterEggService.countFound(ctx.user.id);
  const nextMilestone = streakService.nextMilestone(stats.currentStreak);

  const lines = [
    `👤 <b>${escapeHtml(ctx.user.firstName ?? 'Профиль')}</b>`,
    '',
    `🔥 Streak: ${stats.currentStreak}`,
    `🏆 Лучший streak: ${stats.longestStreak}`,
    `🛡 Щиты: ${ctx.user.streakShields}`,
    '',
    `⭐ Уровень ${stats.level.level}`,
    `${progressBar(stats.level.ratio)}  ${stats.level.xpIntoLevel} / ${stats.level.xpForNextLevel} XP`,
    `До следующего уровня: ${stats.level.xpRemaining} XP`,
    '',
    `📚 Слов в работе: ${stats.wordsTotal}`,
    `🌟 Выучено полностью: ${stats.wordsMastered}`,
    `🎯 Правильных ответов: ${stats.correctAnswers}`,
    '',
    `💰 Баланс: ${ctx.user.balance} ${CURRENCY}`,
    `🏅 Достижения: ${stats.achievementsUnlocked}/${stats.achievementsTotal}`,
    eggs.total > 0 ? `💛 Секретов найдено: ${eggs.found}/${eggs.total}` : '',
    nextMilestone ? `\n🔥 До рубежа ${nextMilestone.target} дней: ${nextMilestone.remaining}` : '',
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
    `⭐ XP: ${ctx.user.xp}`,
    '',
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

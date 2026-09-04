import { Composer } from 'grammy';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { escapeHtml, formatCurrency } from '../format';
import { mainMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';
import { streakService } from '../../services/streak.service';
import { learningService } from '../../services/learning.service';

export const menuComposer = new Composer<BotContext>();

export async function renderMainMenu(ctx: BotContext, greeting?: string): Promise<void> {
  const user = ctx.user;
  const preview = await learningService.getSessionPreview(user);
  const activeToday = await streakService.isActiveToday(user);

  const lines = [
    greeting ? `${greeting}\n` : '',
    `🌸 <b>Главное меню</b>`,
    '',
    `🔥 Streak: ${user.currentStreak} ${activeToday ? '(сегодня отмечен)' : '(сегодня ещё нет)'}`,
    `☀️ Солнышки: ${formatCurrency(user.gems)}`,
    '',
    preview.plannedSize > 0
      ? `📚 На сегодня готово ${preview.plannedSize} ${preview.plannedSize === 1 ? 'карточка' : 'карточек'}`
      : '📚 Все слова повторены — можно отдохнуть',
  ].filter(Boolean);

  await render(ctx, lines.join('\n'), { keyboard: mainMenuKeyboard(user.isAdmin) });
}

menuComposer.callbackQuery(cb(CB.menu, 'main'), async (ctx) => {
  await ack(ctx);
  await renderMainMenu(ctx);
});

menuComposer.callbackQuery(cb(CB.noop, 'x'), async (ctx) => {
  await ack(ctx);
});

menuComposer.command('menu', async (ctx) => {
  await renderMainMenu(ctx);
});

export function greetingFor(firstName: string | null): string {
  return `Привет, ${escapeHtml(firstName ?? 'путешественница')}! 💛`;
}

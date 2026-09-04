import { Composer, InlineKeyboard } from 'grammy';
import { dailyBonusConfig } from '../../config/game.config';
import { dailyBonusService } from '../../services/dailyBonus.service';
import { drainNotices } from '../../events/notice-buffer';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { formatRewardBundle } from '../format';
import { backToMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';

export const bonusComposer = new Composer<BotContext>();

function cycleView(currentDay: number): string {
  return dailyBonusConfig.cycle
    .map((reward, index) => {
      const day = index + 1;
      const marker = day < currentDay ? '✅' : day === currentDay ? '➡️' : '▫️';
      return `${marker} День ${day}: ${formatRewardBundle(reward)}`;
    })
    .join('\n');
}

bonusComposer.callbackQuery(cb(CB.bonus, 'open'), async (ctx) => {
  await ack(ctx);

  const status = dailyBonusService.getStatus(ctx.user);
  const keyboard = status.available
    ? new InlineKeyboard().text('🎁 Забрать', cb(CB.bonus, 'claim')).row().text('⬅️ В меню', cb(CB.menu, 'main'))
    : backToMenuKeyboard();

  await render(
    ctx,
    [
      '🎁 <b>Ежедневный бонус</b>',
      '',
      cycleView(status.dayInCycle),
      '',
      status.available
        ? `Сегодня доступен день ${status.dayInCycle}.`
        : 'Сегодня бонус уже получен. Возвращайся завтра 💛',
    ].join('\n'),
    { keyboard },
  );
});

bonusComposer.callbackQuery(cb(CB.bonus, 'claim'), async (ctx) => {
  const result = await dailyBonusService.claim(ctx.user);

  if (!result.ok) {
    await ack(ctx, 'Бонус уже получен сегодня', true);
    return;
  }

  await ack(ctx, '🎁 Забрано!');
  const notices = drainNotices(ctx.user.id);

  await render(
    ctx,
    [
      '🎁 <b>Бонус получен!</b>',
      '',
      `День ${result.dayInCycle} из ${dailyBonusConfig.cycleLength}`,
      formatRewardBundle(result.reward),
      '',
      `Баланс: ${result.balance}`,
      notices.length ? `\n${notices.map((notice) => `${notice.icon} ${notice.text}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    { keyboard: backToMenuKeyboard() },
  );
});

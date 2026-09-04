import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { greetingFor, renderMainMenu } from './menu.handler';

export const startComposer = new Composer<BotContext>();

startComposer.command('start', async (ctx) => {
  await renderMainMenu(ctx, greetingFor(ctx.user.firstName));
});

startComposer.command('help', async (ctx) => {
  await ctx.reply(
    [
      '🌸 <b>Как играть</b>',
      '',
      '📚 <b>Учиться</b> — короткая тренировка на несколько минут.',
      '🎯 <b>Задания</b> — ежедневные и недельные цели с наградами.',
      '🎁 <b>Бонус</b> — забирай каждый день, награда растёт.',
      '🔥 <b>Streak</b> — заходи каждый день, чтобы не терять серию.',
      '🛍 <b>Магазин</b> — трать кристаллы на щиты и особые награды.',
      '',
      'Команды: /start /menu /help /stats',
    ].join('\n'),
    { parse_mode: 'HTML' },
  );
});

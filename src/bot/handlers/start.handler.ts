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
      '🔥 <b>Streak</b> — заходи каждый день, чтобы не терять серию.',
      '💎 <b>Гемы</b> — получай по одному за каждый правильный ответ.',
      '',
      'Команды: /start /menu /help /stats',
    ].join('\n'),
    { parse_mode: 'HTML' },
  );
});

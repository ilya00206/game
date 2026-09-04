import { Bot, GrammyError, HttpError, MemorySessionStorage, session } from 'grammy';
import { env } from '../config/env';
import { childLogger } from '../utils/logger';
import type { BotContext, SessionData } from './context';
import { adminComposer } from './handlers/admin.handler';
import { learningComposer } from './handlers/learning.handler';
import { menuComposer } from './handlers/menu.handler';
import { profileComposer } from './handlers/profile.handler';
import { settingsComposer } from './handlers/settings.handler';
import { startComposer } from './handlers/start.handler';
import { authMiddleware } from './middlewares/auth.middleware';

const log = childLogger('bot');

const FRIENDLY_ERROR = '😔 Что-то пошло не так.\n\nПопробуй ещё раз.';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);

  bot.use(
    session<SessionData, BotContext>({
      initial: (): SessionData => ({}),
      storage: new MemorySessionStorage<SessionData>(),
    }),
  );

  bot.use(authMiddleware);

  bot.use(startComposer);
  bot.use(menuComposer);
  bot.use(learningComposer);
  bot.use(profileComposer);
  bot.use(settingsComposer);
  bot.use(adminComposer);

  bot.catch(async (error) => {
    const ctx = error.ctx;
    const cause = error.error;

    if (cause instanceof GrammyError) {
      log.error({ description: cause.description, method: cause.method }, 'telegram api error');
    } else if (cause instanceof HttpError) {
      log.error({ cause: String(cause) }, 'telegram network error');
    } else {
      log.error({ err: cause }, 'unhandled bot error');
    }

    // Never surface stack traces to the user.
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: FRIENDLY_ERROR, show_alert: true });
      } else if (ctx.chat) {
        await ctx.reply(FRIENDLY_ERROR);
      }
    } catch (replyError) {
      log.debug({ replyError }, 'failed to deliver the error message');
    }
  });

  return bot;
}

export const BOT_COMMANDS = [
  { command: 'start', description: 'Начать игру' },
  { command: 'menu', description: 'Главное меню' },
  { command: 'stats', description: 'Мой прогресс' },
  { command: 'help', description: 'Как играть' },
];

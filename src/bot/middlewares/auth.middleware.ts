import type { NextFunction } from 'grammy';
import { env } from '../../config/env';
import { userService } from '../../services/user.service';
import { childLogger } from '../../utils/logger';
import type { BotContext } from '../context';

const log = childLogger('auth');

/** Loads (or creates) the domain user for every incoming update. */
export async function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from || from.is_bot) return;

  const telegramId = BigInt(from.id);
  if (env.ALLOWED_TELEGRAM_IDS.length > 0 && !env.ALLOWED_TELEGRAM_IDS.includes(telegramId)) {
    log.info({ telegramId: from.id }, 'user is not in the allowlist');
    return;
  }

  const { user } = await userService.ensureUser({
    telegramId,
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
    languageCode: from.language_code,
  });

  if (user.isBanned) {
    log.warn({ userId: user.id }, 'banned user blocked');
    return;
  }

  ctx.user = user;
  await next();
}

/** Guards admin-only routes. The admin id comes from env, never from callbacks. */
export async function adminOnly(ctx: BotContext, next: NextFunction): Promise<void> {
  if (!ctx.from || BigInt(ctx.from.id) !== env.ADMIN_TELEGRAM_ID) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Недоступно', show_alert: true });
    return;
  }
  await next();
}

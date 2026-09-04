import { GrammyError } from 'grammy';
import type { InlineKeyboard } from 'grammy';
import type { BotContext } from './context';
import { childLogger } from '../utils/logger';

const log = childLogger('render');

export interface RenderOptions {
  keyboard?: InlineKeyboard | undefined;
  disablePreview?: boolean;
}

/**
 * Renders a screen by editing the existing message when possible, falling back
 * to a new message. Keeps the chat clean as required by the UX rules.
 */
export async function render(ctx: BotContext, text: string, options: RenderOptions = {}): Promise<void> {
  const payload = {
    parse_mode: 'HTML' as const,
    reply_markup: options.keyboard,
    link_preview_options: { is_disabled: options.disablePreview ?? true },
  };

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, payload);
      return;
    } catch (error) {
      // "message is not modified" is expected when re-rendering the same screen.
      if (error instanceof GrammyError && error.description.includes('message is not modified')) return;
      log.debug({ error }, 'edit failed, sending a new message');
    }
  }

  await ctx.reply(text, payload);
}

/** Answers a callback query, swallowing the "query is too old" error. */
export async function ack(ctx: BotContext, text?: string, showAlert = false): Promise<void> {
  if (!ctx.callbackQuery) return;
  try {
    await ctx.answerCallbackQuery(text ? { text, show_alert: showAlert } : undefined);
  } catch (error) {
    log.debug({ error }, 'answerCallbackQuery failed');
  }
}

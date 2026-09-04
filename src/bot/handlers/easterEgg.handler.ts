import { Composer } from 'grammy';
import { easterEggService } from '../../services/easterEgg.service';
import { RewardContentType } from '@prisma/client';
import type { BotContext } from '../context';
import { escapeHtml, formatRewardBundle } from '../format';
import { parseRewardBundle } from '../../services/reward.service';

export const easterEggComposer = new Composer<BotContext>();

/**
 * Hidden personal layer. Runs last in the text pipeline so it never shadows
 * commands or admin wizards.
 */
easterEggComposer.on('message:text', async (ctx, next) => {
  const egg = await easterEggService.findByText(ctx.message.text);
  if (!egg) {
    await next();
    return;
  }

  const result = await easterEggService.claim(ctx.user, egg);
  const bundle = parseRewardBundle(egg.reward);

  const caption = [
    `💛 <b>${escapeHtml(egg.title)}</b>`,
    egg.contentText ? `\n${escapeHtml(egg.contentText)}` : '',
    result.granted && (bundle.currency || bundle.xp) ? `\n${formatRewardBundle(bundle)}` : '',
    result.firstTime ? '' : '\n<i>(ты уже находила это раньше)</i>',
  ]
    .filter(Boolean)
    .join('\n');

  if (egg.contentFileId) {
    switch (egg.contentType) {
      case RewardContentType.PHOTO:
        await ctx.replyWithPhoto(egg.contentFileId, { caption, parse_mode: 'HTML' });
        return;
      case RewardContentType.VIDEO:
        await ctx.replyWithVideo(egg.contentFileId, { caption, parse_mode: 'HTML' });
        return;
      case RewardContentType.ANIMATION:
        await ctx.replyWithAnimation(egg.contentFileId, { caption, parse_mode: 'HTML' });
        return;
      case RewardContentType.VOICE:
        await ctx.replyWithVoice(egg.contentFileId, { caption, parse_mode: 'HTML' });
        return;
      case RewardContentType.STICKER:
        await ctx.replyWithSticker(egg.contentFileId);
        await ctx.reply(caption, { parse_mode: 'HTML' });
        return;
      default:
        break;
    }
  }

  await ctx.reply(caption, { parse_mode: 'HTML' });
});

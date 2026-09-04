import { RewardContentType } from '@prisma/client';
import { Composer, InlineKeyboard } from 'grammy';
import { personalRewardService } from '../../services/personalReward.service';
import { shopService } from '../../services/shop.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { CURRENCY, escapeHtml } from '../format';
import { backToMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';

export const shopComposer = new Composer<BotContext>();

async function renderShop(ctx: BotContext): Promise<void> {
  const [items, rewards] = await Promise.all([shopService.listItems(), personalRewardService.list()]);

  const keyboard = new InlineKeyboard();
  const lines = ['🛍 <b>Магазин</b>', '', `Баланс: ${ctx.user.balance} ${CURRENCY}`, ''];

  if (items.length) {
    for (const item of items) {
      lines.push(`${item.icon} <b>${escapeHtml(item.title)}</b> — ${item.price} ${CURRENCY}`);
      lines.push(`   <i>${escapeHtml(item.description)}</i>`);
      keyboard.text(`${item.icon} ${item.title} · ${item.price}`, cb(CB.shop, 'buy', item.id)).row();
    }
  }

  if (rewards.length) {
    lines.push('', '🎁 <b>Особые награды</b>');
    for (const reward of rewards) {
      lines.push(`${reward.icon} <b>${escapeHtml(reward.title)}</b> — ${reward.price} ${CURRENCY}`);
      keyboard.text(`${reward.icon} ${reward.title} · ${reward.price}`, cb(CB.rewards, 'buy', reward.id)).row();
    }
  }

  if (!items.length && !rewards.length) {
    lines.push('Полки пока пусты. Загляни позже 💛');
  }

  keyboard.text('🎒 Мои покупки', cb(CB.rewards, 'mine')).row().text('⬅️ В меню', cb(CB.menu, 'main'));

  await render(ctx, lines.join('\n'), { keyboard });
}

shopComposer.callbackQuery(cb(CB.shop, 'list'), async (ctx) => {
  await ack(ctx);
  await renderShop(ctx);
});

shopComposer.callbackQuery(/^shop:buy:([^:]+)$/, async (ctx) => {
  const itemId = ctx.match[1];
  if (!itemId) {
    await ack(ctx);
    return;
  }

  // Price and availability are read from the DB inside the service.
  const result = await shopService.purchase(ctx.user, itemId);

  if (!result.ok) {
    if (result.reason === 'insufficient_funds') {
      await ack(ctx, `❌ Недостаточно валюты\nНужно: ${result.price} ${CURRENCY}\nУ тебя: ${result.balance}`, true);
    } else if (result.reason === 'limit_reached') {
      await ack(ctx, 'Это уже куплено', true);
    } else if (result.reason === 'out_of_stock') {
      await ack(ctx, 'Товар закончился', true);
    } else {
      await ack(ctx, 'Товар недоступен', true);
    }
    await renderShop(ctx);
    return;
  }

  await ack(ctx, `✅ Куплено: ${result.item.title}`);
  ctx.user.balance = result.balance;
  await renderShop(ctx);
});

shopComposer.callbackQuery(/^rw:buy:([^:]+)$/, async (ctx) => {
  const rewardId = ctx.match[1];
  if (!rewardId) {
    await ack(ctx);
    return;
  }

  const result = await personalRewardService.purchase(ctx.user, rewardId);

  if (!result.ok) {
    if (result.reason === 'insufficient_funds') {
      await ack(ctx, `❌ Недостаточно валюты\nНужно: ${result.price} ${CURRENCY}\nУ тебя: ${result.balance}`, true);
    } else if (result.reason === 'limit_reached') {
      await ack(ctx, 'Эта награда уже твоя', true);
    } else {
      await ack(ctx, 'Награда недоступна', true);
    }
    return;
  }

  await ack(ctx, '🎁 Открываем...');
  ctx.user.balance = result.balance;
  await deliverReward(ctx, result.reward, result.purchaseId);
});

shopComposer.callbackQuery(cb(CB.rewards, 'mine'), async (ctx) => {
  await ack(ctx);

  const [owned, inventory] = await Promise.all([
    personalRewardService.listOwned(ctx.user.id),
    shopService.getInventory(ctx.user.id),
  ]);

  const keyboard = new InlineKeyboard();
  const lines = ['🎒 <b>Мои покупки</b>', ''];

  if (inventory.length) {
    lines.push('<b>Предметы</b>');
    for (const item of inventory) lines.push(`• ${escapeHtml(item.code)} × ${item.quantity}`);
    lines.push('');
  }

  if (owned.length) {
    lines.push('<b>Награды</b>');
    for (const purchase of owned) {
      lines.push(`${purchase.reward.icon} ${escapeHtml(purchase.reward.title)}`);
      keyboard.text(`👀 ${purchase.reward.title}`, cb(CB.rewards, 'open', purchase.id)).row();
    }
  }

  if (!inventory.length && !owned.length) lines.push('Пока пусто.');

  keyboard.text('⬅️ В меню', cb(CB.menu, 'main'));
  await render(ctx, lines.join('\n'), { keyboard });
});

shopComposer.callbackQuery(/^rw:open:([^:]+)$/, async (ctx) => {
  const purchaseId = ctx.match[1];
  if (!purchaseId) {
    await ack(ctx);
    return;
  }

  const owned = await personalRewardService.listOwned(ctx.user.id);
  const purchase = owned.find((entry) => entry.id === purchaseId);
  if (!purchase) {
    await ack(ctx, 'Награда не найдена', true);
    return;
  }

  await ack(ctx);
  await deliverReward(ctx, purchase.reward, purchase.id);
});

async function deliverReward(
  ctx: BotContext,
  reward: { title: string; description: string; contentType: RewardContentType; contentText: string | null; contentFileId: string | null },
  purchaseId: string,
): Promise<void> {
  const caption = [`🎁 <b>${escapeHtml(reward.title)}</b>`, '', escapeHtml(reward.description)].join('\n');
  const options = { parse_mode: 'HTML' as const };

  try {
    switch (reward.contentType) {
      case RewardContentType.PHOTO:
        if (reward.contentFileId) await ctx.replyWithPhoto(reward.contentFileId, { caption, ...options });
        break;
      case RewardContentType.VIDEO:
        if (reward.contentFileId) await ctx.replyWithVideo(reward.contentFileId, { caption, ...options });
        break;
      case RewardContentType.ANIMATION:
        if (reward.contentFileId) await ctx.replyWithAnimation(reward.contentFileId, { caption, ...options });
        break;
      case RewardContentType.DOCUMENT:
        if (reward.contentFileId) await ctx.replyWithDocument(reward.contentFileId, { caption, ...options });
        break;
      case RewardContentType.AUDIO:
        if (reward.contentFileId) await ctx.replyWithAudio(reward.contentFileId, { caption, ...options });
        break;
      case RewardContentType.VOICE:
        if (reward.contentFileId) await ctx.replyWithVoice(reward.contentFileId, { caption, ...options });
        break;
      case RewardContentType.STICKER:
        if (reward.contentFileId) await ctx.replyWithSticker(reward.contentFileId);
        break;
      default:
        break;
    }

    if (reward.contentText) {
      await ctx.reply([caption, '', escapeHtml(reward.contentText)].join('\n'), options);
    } else if (reward.contentType === RewardContentType.TEXT) {
      await ctx.reply(caption, options);
    }
  } finally {
    await personalRewardService.markOpened(purchaseId);
  }

  await render(ctx, '🎁 Награда открыта. Надеюсь, тебе понравилось 💛', { keyboard: backToMenuKeyboard() });
}

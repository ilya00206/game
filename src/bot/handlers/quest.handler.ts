import { QuestPeriod, UserQuestStatus } from '@prisma/client';
import { Composer, InlineKeyboard } from 'grammy';
import { questMetricLabels } from '../../config/game.config';
import { questService, type UserQuestWithQuest } from '../../services/quest.service';
import { parseRewardBundle } from '../../services/reward.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { escapeHtml, formatRewardBundle, progressBar } from '../format';
import { backToMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';

export const questComposer = new Composer<BotContext>();

function questLine(entry: UserQuestWithQuest): string {
  const ratio = entry.target > 0 ? entry.progress / entry.target : 0;
  const status =
    entry.status === UserQuestStatus.CLAIMED
      ? '✅'
      : entry.status === UserQuestStatus.COMPLETED
        ? '🎁'
        : entry.status === UserQuestStatus.EXPIRED
          ? '⌛'
          : entry.quest.icon;

  return [
    `${status} <b>${escapeHtml(entry.quest.title)}</b>`,
    `   ${progressBar(ratio, 8)} ${entry.progress}/${entry.target} ${questMetricLabels[entry.quest.metric]}`,
    `   Награда: ${formatRewardBundle(parseRewardBundle(entry.quest.reward))}`,
  ].join('\n');
}

async function renderQuests(ctx: BotContext): Promise<void> {
  const quests = await questService.getActiveQuests(ctx.user);

  if (!quests.length) {
    await render(ctx, '🎯 <b>Задания</b>\n\nЗаданий пока нет. Загляни позже.', { keyboard: backToMenuKeyboard() });
    return;
  }

  const daily = quests.filter((entry) => entry.quest.period === QuestPeriod.DAILY);
  const weekly = quests.filter((entry) => entry.quest.period !== QuestPeriod.DAILY);

  const sections = ['🎯 <b>Задания</b>'];
  if (daily.length) sections.push('', '<b>Ежедневные</b>', daily.map(questLine).join('\n\n'));
  if (weekly.length) sections.push('', '<b>Недельные</b>', weekly.map(questLine).join('\n\n'));

  const keyboard = new InlineKeyboard();
  const claimable = quests.filter((entry) => entry.status === UserQuestStatus.COMPLETED);
  for (const entry of claimable) {
    keyboard.text(`🎁 ${entry.quest.title}`, cb(CB.quests, 'claim', entry.id)).row();
  }
  keyboard.text('⬅️ В меню', cb(CB.menu, 'main'));

  await render(ctx, sections.join('\n'), { keyboard });
}

questComposer.callbackQuery(cb(CB.quests, 'list'), async (ctx) => {
  await ack(ctx);
  await renderQuests(ctx);
});

questComposer.callbackQuery(/^quest:claim:([^:]+)$/, async (ctx) => {
  const userQuestId = ctx.match[1];
  if (!userQuestId) {
    await ack(ctx);
    return;
  }

  const result = await questService.claim(ctx.user.id, userQuestId);

  if (!result.ok) {
    const messages = {
      not_found: 'Задание не найдено',
      not_completed: 'Задание ещё не выполнено',
      already_claimed: 'Награда уже получена',
    } as const;
    await ack(ctx, messages[result.reason ?? 'not_found'], true);
    await renderQuests(ctx);
    return;
  }

  await ack(ctx, `Награда: ${formatRewardBundle(result.bundle ?? {})}`);
  await renderQuests(ctx);
});

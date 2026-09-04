import { Composer } from 'grammy';
import { achievementService } from '../../services/achievement.service';
import { parseRewardBundle } from '../../services/reward.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { escapeHtml, formatRewardBundle } from '../format';
import { backToMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';

export const achievementComposer = new Composer<BotContext>();

achievementComposer.callbackQuery(cb(CB.achievements, 'list'), async (ctx) => {
  await ack(ctx);

  // Evaluating on open guarantees the list is never stale.
  await achievementService.evaluate(ctx.user.id);
  const entries = await achievementService.listForUser(ctx.user.id);
  const unlocked = entries.filter((entry) => entry.unlockedAt).length;

  const lines = [`🏆 <b>Достижения</b> — ${unlocked}/${entries.length}`, ''];

  for (const entry of entries) {
    const isUnlocked = Boolean(entry.unlockedAt);
    if (entry.achievement.isSecret && !isUnlocked) {
      lines.push('🔒 <i>Секретное достижение</i>');
      continue;
    }

    lines.push(
      `${isUnlocked ? entry.achievement.icon : '▫️'} <b>${escapeHtml(entry.achievement.title)}</b>` +
        (isUnlocked ? '' : ` — ${escapeHtml(entry.achievement.description)}`),
    );

    if (!isUnlocked && entry.achievement.reward) {
      lines.push(`   Награда: ${formatRewardBundle(parseRewardBundle(entry.achievement.reward))}`);
    }
  }

  await render(ctx, lines.join('\n'), { keyboard: backToMenuKeyboard() });
});

import { Composer, InlineKeyboard } from 'grammy';
import { userService } from '../../services/user.service';
import { isValidTimeZone } from '../../utils/time';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { escapeHtml } from '../format';
import { backToMenuKeyboard } from '../keyboards/main.keyboard';
import { ack, render } from '../render';

export const settingsComposer = new Composer<BotContext>();

const TIMEZONE_PRESETS = ['Europe/Kaliningrad', 'Europe/Moscow', 'Europe/Kyiv', 'Europe/Warsaw', 'Asia/Almaty'];

async function renderSettings(ctx: BotContext): Promise<void> {
  const settings = await userService.getNotificationSettings(ctx.user.id);

  const keyboard = new InlineKeyboard()
    .text(
      `${settings.notificationsEnabled ? '🔔' : '🔕'} Уведомления`,
      cb(CB.settings, 'toggle', 'notificationsEnabled'),
    )
    .row()
    .text(
      `${settings.dailyReminderEnabled ? '✅' : '▫️'} Напоминание об учёбе`,
      cb(CB.settings, 'toggle', 'dailyReminderEnabled'),
    )
    .row()
    .text(
      `${settings.streakReminderEnabled ? '✅' : '▫️'} Напоминание о streak`,
      cb(CB.settings, 'toggle', 'streakReminderEnabled'),
    )
    .row()
    .text('🌍 Часовой пояс', cb(CB.settings, 'tz'))
    .row()
    .text('⬅️ В меню', cb(CB.menu, 'main'));

  await render(
    ctx,
    [
      '⚙️ <b>Настройки</b>',
      '',
      `🌍 Часовой пояс: <code>${escapeHtml(ctx.user.timezone)}</code>`,
      `⏰ Время напоминания: ${escapeHtml(settings.reminderTime)}`,
      '',
      'Все ежедневные механики считаются по твоему часовому поясу.',
    ].join('\n'),
    { keyboard },
  );
}

settingsComposer.callbackQuery(cb(CB.settings, 'open'), async (ctx) => {
  await ack(ctx);
  await renderSettings(ctx);
});

settingsComposer.callbackQuery(/^set:toggle:(\w+)$/, async (ctx) => {
  const key = ctx.match[1];
  const allowed = ['notificationsEnabled', 'dailyReminderEnabled', 'streakReminderEnabled'];
  if (!key || !allowed.includes(key)) {
    await ack(ctx);
    return;
  }

  const settings = await userService.getNotificationSettings(ctx.user.id);
  const current = settings[key as keyof typeof settings] as boolean;
  await userService.updateNotificationSettings(ctx.user.id, { [key]: !current });

  await ack(ctx);
  await renderSettings(ctx);
});

settingsComposer.callbackQuery(cb(CB.settings, 'tz'), async (ctx) => {
  await ack(ctx);

  const keyboard = new InlineKeyboard();
  for (const zone of TIMEZONE_PRESETS) {
    keyboard.text(zone, cb(CB.settings, 'tzset', zone)).row();
  }
  keyboard.text('⬅️ Назад', cb(CB.settings, 'open'));

  await render(ctx, '🌍 <b>Часовой пояс</b>\n\nВыбери свой пояс:', { keyboard });
});

settingsComposer.callbackQuery(/^set:tzset:(.+)$/, async (ctx) => {
  const zone = ctx.match[1];
  if (!zone || !isValidTimeZone(zone)) {
    await ack(ctx, 'Неизвестный часовой пояс', true);
    return;
  }

  const updated = await userService.setTimezone(ctx.user.id, zone);
  ctx.user = updated;

  await ack(ctx, `Часовой пояс: ${zone}`);
  await renderSettings(ctx);
});

settingsComposer.command('menu_settings', async (ctx) => {
  await renderSettings(ctx);
});

export { backToMenuKeyboard };

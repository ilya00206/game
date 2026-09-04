import type { Bot } from 'grammy';
import { GrammyError } from 'grammy';
import { prisma } from '../db/prisma';
import { childLogger } from '../utils/logger';
import { getDayKey, getLocalParts } from '../utils/time';
import type { BotContext } from '../bot/context';
import { CB, cb } from '../bot/callback-data';
import { InlineKeyboard } from 'grammy';

const log = childLogger('scheduler');

const TICK_INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_WINDOW_MINUTES = 10;

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Sends at most one reminder per user per day, inside a short window around
 * their configured local time. Never nags users who already trained today.
 */
async function sendReminders(bot: Bot<BotContext>, now: Date): Promise<void> {
  const settings = await prisma.notificationSettings.findMany({
    where: { notificationsEnabled: true, dailyReminderEnabled: true },
    include: { user: true },
  });

  for (const entry of settings) {
    const user = entry.user;
    if (user.isBanned) continue;

    const todayDayKey = getDayKey(now, user.timezone);
    if (entry.lastDailyReminderDay === todayDayKey) continue;
    if (user.lastActivityDay === todayDayKey) continue;

    const target = parseReminderTime(entry.reminderTime);
    if (!target) continue;

    const local = getLocalParts(now, user.timezone);
    const delta =
      minutesSinceMidnight(local.hour, local.minute) - minutesSinceMidnight(target.hour, target.minute);
    if (delta < 0 || delta > REMINDER_WINDOW_MINUTES) continue;

    const text = user.currentStreak > 0
      ? `🔥 Твой streak — ${user.currentStreak}. Пара минут, и он продолжится!`
      : '🌞 Пара минут на слова? Я приготовил карточки.';

    try {
      await bot.api.sendMessage(Number(user.telegramId), text, {
        reply_markup: new InlineKeyboard().text('📚 Учиться', cb(CB.learn, 'start')),
      });
      await prisma.notificationSettings.update({
        where: { id: entry.id },
        data: { lastDailyReminderDay: todayDayKey },
      });
    } catch (error) {
      // 403 = the user blocked the bot; stop bothering them.
      if (error instanceof GrammyError && error.error_code === 403) {
        await prisma.notificationSettings.update({
          where: { id: entry.id },
          data: { notificationsEnabled: false },
        });
        continue;
      }
      log.warn({ error, userId: user.id }, 'reminder delivery failed');
    }
  }
}

export function startScheduler(bot: Bot<BotContext>): () => void {
  const tick = async () => {
    const now = new Date();
    try {
      await sendReminders(bot, now);
    } catch (error) {
      log.error({ error }, 'scheduler tick failed');
    }
  };

  const timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  timer.unref?.();
  void tick();

  log.info('scheduler started');
  return () => clearInterval(timer);
}

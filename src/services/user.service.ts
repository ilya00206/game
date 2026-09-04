import type { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma, type Db } from '../db/prisma';
import { isValidTimeZone } from '../utils/time';

export interface TelegramIdentity {
  telegramId: bigint;
  username?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  languageCode?: string | undefined;
}

export const userService = {
  async findByTelegramId(telegramId: bigint, db: Db = prisma): Promise<User | null> {
    return db.user.findUnique({ where: { telegramId } });
  },

  /** Creates the user on first `/start`, otherwise refreshes the Telegram profile. */
  async ensureUser(identity: TelegramIdentity): Promise<{ user: User; created: boolean }> {
    const existing = await prisma.user.findUnique({ where: { telegramId: identity.telegramId } });

    if (existing) {
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          username: identity.username ?? existing.username,
          firstName: identity.firstName ?? existing.firstName,
          lastName: identity.lastName ?? existing.lastName,
          isAdmin: identity.telegramId === env.ADMIN_TELEGRAM_ID,
          lastActiveAt: new Date(),
        },
      });
      return { user, created: false };
    }

    const user = await prisma.user.create({
      data: {
        telegramId: identity.telegramId,
        username: identity.username ?? null,
        firstName: identity.firstName ?? null,
        lastName: identity.lastName ?? null,
        language: identity.languageCode?.slice(0, 2) ?? 'ru',
        learningLanguage: 'pl',
        timezone: env.DEFAULT_TIMEZONE,
        isAdmin: identity.telegramId === env.ADMIN_TELEGRAM_ID,
        notificationSettings: { create: {} },
      },
    });

    return { user, created: true };
  },

  async touch(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
  },

  async setTimezone(userId: string, timezone: string): Promise<User> {
    if (!isValidTimeZone(timezone)) {
      throw new Error(`Unknown timezone: ${timezone}`);
    }
    return prisma.user.update({ where: { id: userId }, data: { timezone } });
  },

  async getNotificationSettings(userId: string) {
    return prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  },

  async updateNotificationSettings(
    userId: string,
    data: Partial<{
      notificationsEnabled: boolean;
      dailyReminderEnabled: boolean;
      streakReminderEnabled: boolean;
      reminderTime: string;
    }>,
  ) {
    return prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },
};

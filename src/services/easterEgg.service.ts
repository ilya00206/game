import { GameEventType, type EasterEgg, type User } from '@prisma/client';
import { env } from '../config/env';
import { prisma, runInTransaction } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { parseRewardBundle, rewardService } from './reward.service';

const log = childLogger('easter-egg');

export type EggTrigger =
  | { kind: 'command'; value: string }
  | { kind: 'phrase'; value: string }
  | { kind: 'streak'; value: number }
  | { kind: 'level'; value: number }
  | { kind: 'date'; value: string }; // MM-DD

function parseTrigger(value: unknown): EggTrigger | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  const raw = record.value;

  if (kind === 'streak' || kind === 'level') {
    return typeof raw === 'number' ? { kind, value: raw } : null;
  }
  if (kind === 'command' || kind === 'phrase' || kind === 'date') {
    return typeof raw === 'string' ? { kind, value: raw } : null;
  }
  return null;
}

/**
 * Personal easter-egg layer: hidden messages and media the admin can hide
 * behind commands, phrases, streak lengths, levels or calendar dates.
 * Entirely data driven so new secrets never require a deploy.
 */
export const easterEggService = {
  async findByText(text: string): Promise<EasterEgg | null> {
    if (!env.EASTER_EGGS_ENABLED) return null;

    const normalised = text.trim().toLowerCase();
    if (!normalised) return null;

    const eggs = await prisma.easterEgg.findMany({ where: { isActive: true } });
    return (
      eggs.find((egg) => {
        const trigger = parseTrigger(egg.trigger);
        if (!trigger) return false;
        if (trigger.kind === 'command') return normalised === trigger.value.toLowerCase();
        if (trigger.kind === 'phrase') return normalised.includes(trigger.value.toLowerCase());
        return false;
      }) ?? null
    );
  },

  async findByMilestone(kind: 'streak' | 'level', value: number): Promise<EasterEgg[]> {
    if (!env.EASTER_EGGS_ENABLED) return [];

    const eggs = await prisma.easterEgg.findMany({ where: { isActive: true } });
    return eggs.filter((egg) => {
      const trigger = parseTrigger(egg.trigger);
      return trigger?.kind === kind && trigger.value === value;
    });
  },

  async findByDate(now: Date, timezone: string): Promise<EasterEgg[]> {
    if (!env.EASTER_EGGS_ENABLED) return [];

    const monthDay = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, month: '2-digit', day: '2-digit' })
      .format(now)
      .slice(-5);

    const eggs = await prisma.easterEgg.findMany({ where: { isActive: true } });
    return eggs.filter((egg) => {
      const trigger = parseTrigger(egg.trigger);
      return trigger?.kind === 'date' && trigger.value === monthDay;
    });
  },

  /** Records a find. Returns false when a non-repeatable egg was already found. */
  async claim(user: User, egg: EasterEgg): Promise<{ granted: boolean; firstTime: boolean }> {
    const existing = await prisma.userEasterEgg.findUnique({
      where: { userId_eggId: { userId: user.id, eggId: egg.id } },
    });

    if (existing && !egg.isRepeatable) {
      return { granted: false, firstTime: false };
    }

    await runInTransaction(async (tx) => {
      await tx.userEasterEgg.upsert({
        where: { userId_eggId: { userId: user.id, eggId: egg.id } },
        create: { userId: user.id, eggId: egg.id },
        update: { times: { increment: 1 } },
      });

      const bundle = parseRewardBundle(egg.reward);
      await rewardService.grantInTransaction(tx, {
        userId: user.id,
        bundle,
        reason: `easter_egg:${egg.code}`,
        idempotencyKey: `easter_egg:${user.id}:${egg.id}`,
      });
    });

    log.info({ userId: user.id, code: egg.code }, 'easter egg found');
    await gameEvents.emit(GameEventType.EASTER_EGG_FOUND, { userId: user.id, eggCode: egg.code });

    return { granted: true, firstTime: !existing };
  },

  async countFound(userId: string): Promise<{ found: number; total: number }> {
    const [found, total] = await Promise.all([
      prisma.userEasterEgg.count({ where: { userId } }),
      prisma.easterEgg.count({ where: { isActive: true } }),
    ]);
    return { found, total };
  },
};

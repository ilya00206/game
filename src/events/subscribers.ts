import { GameEventType, QuestMetric, type Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { achievementService } from '../services/achievement.service';
import { questService } from '../services/quest.service';
import { childLogger } from '../utils/logger';
import { gameEvents } from './event-bus';
import { pushNotice } from './notice-buffer';

const log = childLogger('subscribers');

async function loadUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

/**
 * Wires the gameplay reactions together.
 *
 * Every cross-cutting consequence of an action lives here, which keeps the
 * producing services (learning, streak, economy) unaware of quests,
 * achievements and analytics.
 */
export function registerGameSubscribers(): void {
  // --- persistent audit log -------------------------------------------------
  const logged: GameEventType[] = [
    GameEventType.USER_REGISTERED,
    GameEventType.SESSION_COMPLETED,
    GameEventType.STREAK_MILESTONE_REACHED,
    GameEventType.LEVEL_UP,
    GameEventType.ACHIEVEMENT_UNLOCKED,
    GameEventType.DAILY_BONUS_CLAIMED,
    GameEventType.SHOP_PURCHASE,
    GameEventType.QUEST_CLAIMED,
    GameEventType.EASTER_EGG_FOUND,
  ];

  for (const type of logged) {
    gameEvents.on(type, async (event) => {
      const payload = event.payload as { userId?: string };
      await prisma.gameEventLog.create({
        data: {
          userId: payload.userId ?? null,
          type: event.type,
          payload: event.payload as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  // --- quest progress ------------------------------------------------------
  gameEvents.on(GameEventType.WORD_ANSWERED, async (event) => {
    const user = await loadUser(event.payload.userId);
    if (!user) return;

    await questService.trackProgress(user, QuestMetric.WORDS_ANSWERED, 1);
    if (event.payload.isCorrect) {
      await questService.trackProgress(user, QuestMetric.CORRECT_ANSWERS, 1);
    }
  });

  gameEvents.on(GameEventType.WORD_MASTERED, async (event) => {
    const user = await loadUser(event.payload.userId);
    if (user) await questService.trackProgress(user, QuestMetric.WORDS_MASTERED, 1);
  });

  gameEvents.on(GameEventType.SESSION_COMPLETED, async (event) => {
    const user = await loadUser(event.payload.userId);
    if (!user) return;

    await questService.trackProgress(user, QuestMetric.SESSIONS_COMPLETED, 1);
    await questService.trackProgress(user, QuestMetric.XP_EARNED, event.payload.xpEarned);
    await achievementService.evaluate(user.id);
  });

  gameEvents.on(GameEventType.DAILY_ACTIVITY_COMPLETED, async (event) => {
    const user = await loadUser(event.payload.userId);
    if (user) await questService.trackProgress(user, QuestMetric.ACTIVE_DAYS, 1);
  });

  gameEvents.on(GameEventType.DAILY_BONUS_CLAIMED, async (event) => {
    const user = await loadUser(event.payload.userId);
    if (!user) return;

    await questService.trackProgress(user, QuestMetric.DAILY_BONUS_CLAIMED, 1);
    await achievementService.evaluate(user.id);
  });

  gameEvents.on(GameEventType.STREAK_UPDATED, async (event) => {
    await achievementService.evaluate(event.payload.userId);
  });

  // --- user facing notices -------------------------------------------------
  gameEvents.on(GameEventType.LEVEL_UP, (event) => {
    pushNotice(event.payload.userId, {
      icon: '⭐',
      text: `Новый уровень: ${event.payload.toLevel}!`,
    });
  });

  gameEvents.on(GameEventType.ACHIEVEMENT_UNLOCKED, (event) => {
    pushNotice(event.payload.userId, {
      icon: event.payload.icon,
      text: `Достижение получено: ${event.payload.title}`,
    });
  });

  gameEvents.on(GameEventType.QUEST_COMPLETED, (event) => {
    pushNotice(event.payload.userId, { icon: '🎯', text: 'Задание выполнено — забери награду!' });
  });

  gameEvents.on(GameEventType.STREAK_MILESTONE_REACHED, (event) => {
    pushNotice(event.payload.userId, { icon: '🔥', text: `Рубеж streak: ${event.payload.milestone} дней!` });
  });

  log.info('game event subscribers registered');
}

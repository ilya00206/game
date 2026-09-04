import { dailyBonusConfig, type RewardBundleConfig } from '../config/game.config';
import { daysBetweenDayKeys } from '../utils/time';

export function cycleIndex(dayInCycle: number): number {
  return (dayInCycle - 1) % dailyBonusConfig.cycleLength;
}

export function rewardForCycleDay(dayInCycle: number): RewardBundleConfig {
  return dailyBonusConfig.cycle[cycleIndex(dayInCycle)] ?? {};
}

/**
 * Which day of the bonus cycle the user lands on if they claim right now.
 * Claiming on consecutive days advances the cycle; a gap restarts it at day 1.
 */
export function computeNextCycleDay(lastClaimDay: string | null, bonusStreak: number, todayDayKey: string): number {
  if (!lastClaimDay) return 1;

  const gap = daysBetweenDayKeys(lastClaimDay, todayDayKey);
  if (gap === 1) return bonusStreak + 1;
  if (gap <= 0) return Math.max(1, bonusStreak);
  return 1;
}

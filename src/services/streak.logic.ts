import { streakConfig } from '../config/game.config';
import { daysBetweenDayKeys } from '../utils/time';

export interface StreakInput {
  currentStreak: number;
  longestStreak: number;
  lastActivityDay: string | null;
  availableShields: number;
  /** Local day key of the activity being registered. */
  todayDayKey: string;
}

export interface StreakOutcome {
  /** False when the user was already counted for this local day. */
  changed: boolean;
  currentStreak: number;
  longestStreak: number;
  shieldsConsumed: number;
  protectedByShield: boolean;
  /** Set when the new streak length exactly matches a configured milestone. */
  milestoneReached: number | null;
  /** True when the streak was reset because too many days were missed. */
  streakBroken: boolean;
}

/**
 * Pure streak transition. No IO, no clock access — everything is derived from
 * the caller supplied local day keys, which makes timezone behaviour testable.
 *
 * Rules:
 *  - one increment per local day, no matter how many sessions were completed;
 *  - a gap of exactly one day (or fewer than `maxShieldedDays`) can be covered
 *    by streak shields;
 *  - otherwise the streak restarts at 1 (never at 0: today still counts).
 */
export function computeStreak(input: StreakInput): StreakOutcome {
  const { currentStreak, longestStreak, lastActivityDay, availableShields, todayDayKey } = input;

  if (lastActivityDay === todayDayKey) {
    return {
      changed: false,
      currentStreak,
      longestStreak,
      shieldsConsumed: 0,
      protectedByShield: false,
      milestoneReached: null,
      streakBroken: false,
    };
  }

  if (!lastActivityDay) {
    return finalise(1, longestStreak, 0, false, false);
  }

  const gap = daysBetweenDayKeys(lastActivityDay, todayDayKey);

  // Clock skew or a timezone change moved the user backwards: treat as same day.
  if (gap <= 0) {
    return {
      changed: false,
      currentStreak,
      longestStreak,
      shieldsConsumed: 0,
      protectedByShield: false,
      milestoneReached: null,
      streakBroken: false,
    };
  }

  if (gap === 1) {
    return finalise(currentStreak + 1, longestStreak, 0, false, false);
  }

  const missedDays = gap - 1;
  const coverable = Math.min(missedDays, streakConfig.maxShieldedDays * availableShields);

  if (missedDays > 0 && coverable >= missedDays && availableShields > 0) {
    const shieldsConsumed = Math.ceil(missedDays / streakConfig.maxShieldedDays);
    return finalise(currentStreak + 1, longestStreak, shieldsConsumed, true, false);
  }

  return finalise(1, longestStreak, 0, false, true);
}

function finalise(
  nextStreak: number,
  longestStreak: number,
  shieldsConsumed: number,
  protectedByShield: boolean,
  streakBroken: boolean,
): StreakOutcome {
  return {
    changed: true,
    currentStreak: nextStreak,
    longestStreak: Math.max(longestStreak, nextStreak),
    shieldsConsumed,
    protectedByShield,
    milestoneReached: streakConfig.milestones[nextStreak] ? nextStreak : null,
    streakBroken,
  };
}

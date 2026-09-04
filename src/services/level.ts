import { levelConfig } from '../config/game.config';

/** Cumulative XP needed to reach `level` (level 1 === 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const table = levelConfig.thresholds;
  const index = level - 1;
  const last = table[table.length - 1] ?? 0;
  if (index < table.length) return table[index] ?? 0;
  return last + (index - (table.length - 1)) * levelConfig.overflowStep;
}

export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  const table = levelConfig.thresholds;
  const last = table[table.length - 1] ?? 0;

  if (xp >= last) {
    return table.length + Math.floor((xp - last) / levelConfig.overflowStep);
  }

  for (let index = table.length - 1; index >= 0; index -= 1) {
    if (xp >= (table[index] ?? 0)) return index + 1;
  }
  return 1;
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpRemaining: number;
  ratio: number;
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const xpIntoLevel = totalXp - currentLevelXp;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel: span,
    xpRemaining: Math.max(0, nextLevelXp - totalXp),
    ratio: Math.min(1, xpIntoLevel / span),
  };
}

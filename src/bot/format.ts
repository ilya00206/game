import { env } from '../config/env';
import { uiConfig } from '../config/game.config';
import type { RewardBundle } from '../services/reward.service';

export const CURRENCY = env.CURRENCY_SYMBOL;

/** Escapes text for Telegram HTML parse mode. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function progressBar(ratio: number, length: number = uiConfig.progressBarLength): string {
  const clamped = Math.min(1, Math.max(0, ratio));
  const filled = Math.round(clamped * length);
  return uiConfig.progressBarFilled.repeat(filled) + uiConfig.progressBarEmpty.repeat(length - filled);
}

export function barForValue(value: number, max: number, maxLength: number = uiConfig.weeklyBarMaxLength): string {
  if (max <= 0 || value <= 0) return '·';
  const length = Math.max(1, Math.round((value / max) * maxLength));
  return uiConfig.progressBarFilled.repeat(length);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

export function formatCurrency(amount: number): string {
  return `${amount} ${CURRENCY}`;
}

/** Compact one-line summary of everything a reward bundle gave. */
export function formatRewardBundle(bundle: RewardBundle): string {
  const parts: string[] = [];
  if (bundle.xp) parts.push(`+${bundle.xp} XP`);
  if (bundle.currency) parts.push(`+${bundle.currency} ${CURRENCY}`);
  if (bundle.streakShields) parts.push(`+${bundle.streakShields} 🛡`);
  for (const item of bundle.items ?? []) parts.push(`+${item.quantity} × ${item.code}`);
  return parts.length ? parts.join('   ') : '—';
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function weekdayLabel(index: number): string {
  return WEEKDAYS[index] ?? '';
}

export function pluralRu(count: number, forms: [string, string, string]): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

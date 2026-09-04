export interface Notice {
  icon: string;
  text: string;
}

/**
 * Collects the side effects triggered by one user action (level ups, unlocked
 * achievements, completed quests) so the handler can render a single combined
 * result message instead of spamming the chat.
 */
const buffers = new Map<string, Notice[]>();

export function pushNotice(userId: string, notice: Notice): void {
  const list = buffers.get(userId) ?? [];
  list.push(notice);
  buffers.set(userId, list);
}

export function drainNotices(userId: string): Notice[] {
  const list = buffers.get(userId) ?? [];
  buffers.delete(userId);
  return list;
}

export function clearNotices(userId: string): void {
  buffers.delete(userId);
}

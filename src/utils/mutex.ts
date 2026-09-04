/**
 * Per-key async mutex.
 *
 * Telegram delivers duplicate callback updates and users double-tap buttons.
 * Serialising per user id removes the "two concurrent purchases" race before it
 * reaches PostgreSQL, while the DB transaction remains the real safety net.
 */
const queues = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tracked = run.catch(() => undefined);
  queues.set(key, tracked);

  try {
    return await run;
  } finally {
    if (queues.get(key) === tracked) {
      queues.delete(key);
    }
  }
}

export function lockKey(...parts: Array<string | number | bigint>): string {
  return parts.join(':');
}

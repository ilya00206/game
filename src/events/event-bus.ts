import type { GameEventType } from '@prisma/client';
import { childLogger } from '../utils/logger';
import type { GameEventOf, GameEventPayloads } from './event.types';

type Handler<T extends GameEventType> = (event: GameEventOf<T>) => void | Promise<void>;

const log = childLogger('event-bus');

/**
 * Tiny in-process typed event bus.
 *
 * Services publish domain facts, other services subscribe. This keeps the
 * gameplay modules decoupled: adding a new reaction to WORD_ANSWERED never
 * requires editing the learning service.
 *
 * Handlers are awaited in registration order so that reward side effects are
 * observable by the caller before it renders a result screen.
 */
class GameEventBus {
  private readonly handlers = new Map<GameEventType, Array<Handler<GameEventType>>>();

  on<T extends GameEventType>(type: T, handler: Handler<T>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as unknown as Handler<GameEventType>);
    this.handlers.set(type, list);
    return () => this.off(type, handler);
  }

  off<T extends GameEventType>(type: T, handler: Handler<T>): void {
    const list = this.handlers.get(type);
    if (!list) return;
    const index = list.indexOf(handler as unknown as Handler<GameEventType>);
    if (index >= 0) list.splice(index, 1);
  }

  async emit<T extends GameEventType>(type: T, payload: GameEventPayloads[T]): Promise<void> {
    const event = { type, payload, at: new Date() } as unknown as GameEventOf<T>;
    const list = this.handlers.get(type);
    if (!list?.length) return;

    for (const handler of [...list]) {
      try {
        await handler(event);
      } catch (error) {
        // A misbehaving subscriber must never break the user-facing flow.
        log.error({ error, type }, 'game event handler failed');
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const gameEvents = new GameEventBus();
export type { GameEventBus };

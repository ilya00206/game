import type { User } from '@prisma/client';
import type { Context, SessionFlavor } from 'grammy';

/** Transient per-chat state, e.g. the current admin wizard step. */
export interface SessionData {
  learningGroupId?: string;
  wordEntry?: {
    step: 'groupName' | 'original' | 'translation';
    groupId?: string;
    original?: string;
  };
  admin?: {
    action: string;
    step: string;
    draft: Record<string, unknown>;
  };
  exerciseShownAt?: number;
  awaitingTextAnswer?: {
    sessionId: string;
    position: number;
  };
}

export interface BotContextFlavor {
  /** Always present after the auth middleware, except for banned users. */
  user: User;
}

export type BotContext = Context & SessionFlavor<SessionData> & BotContextFlavor;

import { intervalLadderStrategy } from './interval-ladder.strategy';
import type { SrsStrategy } from './srs.types';

/**
 * The strategy the app currently runs on.
 * Replace this binding to migrate to SM-2 / FSRS; no caller needs to change.
 */
export const srs: SrsStrategy = intervalLadderStrategy;

export * from './srs.types';
export { intervalLadderStrategy, statusForLevel } from './interval-ladder.strategy';

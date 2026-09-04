import pino from 'pino';
import { env, isProduction } from '../config/env';

const redactPaths = [
  'BOT_TOKEN',
  'botToken',
  'token',
  'DATABASE_URL',
  'databaseUrl',
  'password',
  'secret',
  '*.BOT_TOKEN',
  '*.token',
  '*.password',
  '*.secret',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[redacted]' },
  base: { service: 'lingua-quest-bot' },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' },
      },
});

export type Logger = typeof logger;

export function childLogger(scope: string) {
  return logger.child({ scope });
}

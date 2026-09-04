import { webhookCallback } from 'grammy';
import { BOT_COMMANDS, createBot } from './bot/bot';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './db/prisma';
import { startScheduler } from './jobs/scheduler';
import { startHealthServer } from './server/health';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info({ nodeEnv: env.NODE_ENV, mode: env.BOT_MODE }, 'starting lingua-quest-bot');

  await connectDatabase();

  const bot = createBot();
  const useWebhook = env.BOT_MODE === 'webhook' && Boolean(env.WEBHOOK_URL);
  const healthServer = startHealthServer(
    useWebhook ? webhookCallback(bot, 'http', { secretToken: env.WEBHOOK_SECRET }) : undefined,
  );
  const stopScheduler = startScheduler(bot);

  await bot.api.setMyCommands(BOT_COMMANDS);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'shutting down');
    stopScheduler();
    await bot.stop().catch((error) => logger.error({ error }, 'failed to stop the bot'));
    healthServer.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled promise rejection'));
  process.on('uncaughtException', (error) => logger.fatal({ error }, 'uncaught exception'));

  if (useWebhook && env.WEBHOOK_URL) {
    await bot.init();
    await bot.api.setWebhook(`${env.WEBHOOK_URL.replace(/\/$/, '')}/telegram`, {
      secret_token: env.WEBHOOK_SECRET,
      drop_pending_updates: true,
    });
    logger.info('webhook registered');
    return;
  }

  await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => undefined);
  logger.info('starting long polling');
  await bot.start({ onStart: (info) => logger.info({ username: info.username }, 'bot online') });
}

main().catch((error) => {
  logger.fatal({ error }, 'fatal startup error');
  process.exit(1);
});

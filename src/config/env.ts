import 'dotenv/config';
import { z } from 'zod';

// Empty env vars arrive as "" rather than undefined; treat them as unset for optional fields.
const optionalString = () => z.preprocess((value) => (value === '' ? undefined : value), z.string().optional());
const optionalUrl = () => z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional());
const telegramIdList = () =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').map((id) => id.trim()).filter(Boolean) : []),
    z
      .array(z.string().regex(/^\d+$/, 'Telegram ids must be numeric'))
      .transform((ids) => ids.map((id) => BigInt(id))),
  );

const schema = z.object({
  BOT_TOKEN: z.string().min(10, 'BOT_TOKEN is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ADMIN_TELEGRAM_ID: z
    .string()
    .min(1, 'ADMIN_TELEGRAM_ID is required')
    .refine((value) => /^\d+$/.test(value), 'ADMIN_TELEGRAM_ID must be a numeric Telegram id')
    .transform((value) => BigInt(value)),
  ALLOWED_TELEGRAM_IDS: telegramIdList(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),

  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  WEBHOOK_URL: optionalUrl(),
  WEBHOOK_SECRET: optionalString(),

  DEFAULT_TIMEZONE: z.string().default('Europe/Moscow'),

  CURRENCY_NAME: z.string().default('Солнышки'),
  CURRENCY_SYMBOL: z.string().default('☀️'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  // Fail fast and loudly: the bot cannot work with a broken configuration.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

if (parsed.data.BOT_MODE === 'webhook' && !parsed.data.WEBHOOK_URL) {
  throw new Error('WEBHOOK_URL must be set when BOT_MODE=webhook');
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';

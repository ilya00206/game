import { Difficulty } from '@prisma/client';
import { Composer, InlineKeyboard } from 'grammy';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { statsService } from '../../services/stats.service';
import { CB, cb } from '../callback-data';
import type { BotContext } from '../context';
import { escapeHtml } from '../format';
import { adminOnly } from '../middlewares/auth.middleware';
import { ack, render } from '../render';

export const adminComposer = new Composer<BotContext>();
adminComposer.use(adminOnly);

const adminMenuKeyboard = () =>
  new InlineKeyboard()
    .text('📚 Слова', cb(CB.admin, 'words'))
    .row()
    .text('📊 Статистика', cb(CB.admin, 'stats'))
    .text('👤 Игроки', cb(CB.admin, 'users'))
    .row()
    .text('⬅️ В меню', cb(CB.menu, 'main'));

const cancelKeyboard = () => new InlineKeyboard().text('✖️ Отмена', cb(CB.admin, 'cancel'));

// --- wizard definitions -----------------------------------------------------

interface WizardStep {
  key: string;
  prompt: string;
  optional?: boolean;
  parse?: (value: string) => unknown;
}

const WIZARDS: Record<string, { title: string; steps: WizardStep[]; finish: (draft: Record<string, unknown>) => Promise<string> }> = {
  word: {
    title: '📚 Новое слово',
    steps: [
      { key: 'language', prompt: 'Код языка (например <code>fr</code>):' },
      { key: 'original', prompt: 'Слово на изучаемом языке:' },
      { key: 'translation', prompt: 'Перевод:' },
      { key: 'pronunciation', prompt: 'Транскрипция (или <code>-</code>):', optional: true },
      { key: 'exampleSentence', prompt: 'Пример предложения (или <code>-</code>):', optional: true },
      { key: 'exampleTranslation', prompt: 'Перевод примера (или <code>-</code>):', optional: true },
      { key: 'category', prompt: 'Категория (или <code>-</code>):', optional: true },
      {
        key: 'difficulty',
        prompt: 'Сложность: <code>EASY</code> / <code>MEDIUM</code> / <code>HARD</code>',
        parse: (value) => value.trim().toUpperCase(),
      },
    ],
    async finish(draft) {
      const parsed = z
        .object({
          language: z.string().min(2).max(8),
          original: z.string().min(1).max(200),
          translation: z.string().min(1).max(200),
          pronunciation: z.string().max(200).optional(),
          exampleSentence: z.string().max(500).optional(),
          exampleTranslation: z.string().max(500).optional(),
          category: z.string().max(100).optional(),
          difficulty: z.nativeEnum(Difficulty).catch(Difficulty.MEDIUM),
        })
        .parse(draft);

      const word = await prisma.word.create({ data: parsed });
      return `✅ Слово добавлено: <b>${escapeHtml(word.original)}</b> — ${escapeHtml(word.translation)}`;
    },
  },

};

// --- menu -------------------------------------------------------------------

adminComposer.command('admin', async (ctx) => {
  await render(ctx, '⚙️ <b>Admin</b>', { keyboard: adminMenuKeyboard() });
});

adminComposer.callbackQuery(cb(CB.admin, 'menu'), async (ctx) => {
  await ack(ctx);
  ctx.session.admin = undefined;
  await render(ctx, '⚙️ <b>Admin</b>', { keyboard: adminMenuKeyboard() });
});

adminComposer.callbackQuery(cb(CB.admin, 'cancel'), async (ctx) => {
  await ack(ctx, 'Отменено');
  ctx.session.admin = undefined;
  await render(ctx, '⚙️ <b>Admin</b>', { keyboard: adminMenuKeyboard() });
});

adminComposer.callbackQuery(cb(CB.admin, 'stats'), async (ctx) => {
  await ack(ctx);
  const overview = await statsService.getAdminOverview();

  await render(
    ctx,
    [
      '📊 <b>Статистика</b>',
      '',
      `👤 Игроков: ${overview.users} (активны за сутки: ${overview.activeToday})`,
      `📚 Активных слов: ${overview.words}`,
      `🏁 Тренировок завершено: ${overview.sessions}`,
      `✍️ Ответов: ${overview.answers}`,
      `💎 Всего гемов: ${overview.gems}`,
    ].join('\n'),
    { keyboard: new InlineKeyboard().text('⬅️ Назад', cb(CB.admin, 'menu')) },
  );
});

adminComposer.callbackQuery(cb(CB.admin, 'users'), async (ctx) => {
  await ack(ctx);
  const users = await prisma.user.findMany({ orderBy: { lastActiveAt: 'desc' }, take: 15 });

  const lines = ['👤 <b>Игроки</b>', ''];
  for (const user of users) {
    lines.push(
      `• ${escapeHtml(user.firstName ?? String(user.telegramId))} — 🔥${user.currentStreak}, 💎${user.gems}`,
    );
  }

  await render(ctx, lines.join('\n'), { keyboard: new InlineKeyboard().text('⬅️ Назад', cb(CB.admin, 'menu')) });
});

adminComposer.callbackQuery(cb(CB.admin, 'words'), async (ctx) => {
  await ack(ctx);
  const [total, byLanguage] = await Promise.all([
    prisma.word.count(),
    prisma.word.groupBy({ by: ['language'], _count: { _all: true } }),
  ]);

  await render(
    ctx,
    [
      '📚 <b>Слова</b>',
      '',
      `Всего: ${total}`,
      ...byLanguage.map((row) => `• ${row.language}: ${row._count._all}`),
    ].join('\n'),
    {
      keyboard: new InlineKeyboard()
        .text('➕ Добавить слово', cb(CB.admin, 'new', 'word'))
        .row()
        .text('⬅️ Назад', cb(CB.admin, 'menu')),
    },
  );
});

// --- wizard runtime ---------------------------------------------------------

adminComposer.callbackQuery(/^adm:new:(\w+)$/, async (ctx) => {
  const action = ctx.match[1];
  const wizard = action ? WIZARDS[action] : undefined;
  if (!action || !wizard) {
    await ack(ctx);
    return;
  }

  await ack(ctx);
  const firstStep = wizard.steps[0];
  if (!firstStep) return;

  ctx.session.admin = { action, step: firstStep.key, draft: {} };
  await render(ctx, `${wizard.title}\n\n1/${wizard.steps.length}\n${firstStep.prompt}`, { keyboard: cancelKeyboard() });
});

adminComposer.on('message', async (ctx, next) => {
  const state = ctx.session.admin;
  const wizard = state ? WIZARDS[state.action] : undefined;
  if (!state || !wizard) {
    await next();
    return;
  }

  const stepIndex = wizard.steps.findIndex((step) => step.key === state.step);
  const step = wizard.steps[stepIndex];
  if (!step) {
    ctx.session.admin = undefined;
    await next();
    return;
  }

  const message = ctx.message;
  const photos = message?.photo;
  const fileId =
    (photos && photos.length > 0 ? photos[photos.length - 1]?.file_id : undefined) ??
    message?.video?.file_id ??
    message?.animation?.file_id ??
    message?.document?.file_id ??
    message?.audio?.file_id ??
    message?.voice?.file_id ??
    message?.sticker?.file_id;

  const rawValue = fileId ?? message?.text ?? message?.caption ?? '';
  if (!rawValue) {
    await ctx.reply('Пришли текст или файл.');
    return;
  }

  if (rawValue !== '-' || !step.optional) {
    state.draft[step.key] = step.parse ? step.parse(rawValue) : rawValue;
  }

  const nextStep = wizard.steps[stepIndex + 1];
  if (nextStep) {
    state.step = nextStep.key;
    ctx.session.admin = state;
    await ctx.reply(`${stepIndex + 2}/${wizard.steps.length}\n${nextStep.prompt}`, {
      parse_mode: 'HTML',
      reply_markup: cancelKeyboard(),
    });
    return;
  }

  ctx.session.admin = undefined;

  try {
    const summary = await wizard.finish(state.draft);
    await ctx.reply(summary, { parse_mode: 'HTML', reply_markup: adminMenuKeyboard() });
  } catch (error) {
    const reason = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : 'ошибка записи';
    await ctx.reply(`❌ Не удалось сохранить: ${escapeHtml(String(reason))}`, {
      parse_mode: 'HTML',
      reply_markup: adminMenuKeyboard(),
    });
  }
});

/** Utility for grabbing a Telegram file_id when authoring content. */
adminComposer.command('fileid', async (ctx) => {
  await ctx.reply('Пришли фото/видео/гиф следующим сообщением — я верну его file_id.');
});

adminComposer.on(
  ['message:photo', 'message:video', 'message:animation', 'message:document', 'message:sticker', 'message:voice'],
  async (ctx) => {
    const message = ctx.message;
    const photos = message.photo;
    const fileId =
      (photos && photos.length > 0 ? photos[photos.length - 1]?.file_id : undefined) ??
      message.video?.file_id ??
      message.animation?.file_id ??
      message.document?.file_id ??
      message.sticker?.file_id ??
      message.voice?.file_id;

    if (fileId) await ctx.reply(`<code>${escapeHtml(fileId)}</code>`, { parse_mode: 'HTML' });
  },
);

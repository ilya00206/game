import { Composer, InlineKeyboard } from 'grammy';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { statsService } from '../../services/stats.service';
import { streakService } from '../../services/streak.service';
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
    .text('🕓 Активность', cb(CB.admin, 'activity'))
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
      { key: 'original', prompt: 'Слово на изучаемом языке:' },
      { key: 'translation', prompt: 'Перевод:' },
      { key: 'pronunciation', prompt: 'Транскрипция (или <code>-</code>):', optional: true },
      { key: 'exampleSentence', prompt: 'Пример предложения (или <code>-</code>):', optional: true },
      { key: 'exampleTranslation', prompt: 'Перевод примера (или <code>-</code>):', optional: true },
      { key: 'groups', prompt: 'Группы через запятую (например <code>greetings, animals</code>):' },
    ],
    async finish(draft) {
      const parsed = z
        .object({
          original: z.string().min(1).max(200),
          translation: z.string().min(1).max(200),
          pronunciation: z.string().max(200).optional(),
          exampleSentence: z.string().max(500).optional(),
          exampleTranslation: z.string().max(500).optional(),
          groups: z.string().min(1).max(500),
        })
        .parse(draft);

      const groupNames = parsed.groups.split(',').map((name) => name.trim()).filter(Boolean);
      if (!groupNames.length) throw new Error('укажи хотя бы одну группу');

      const word = await prisma.word.create({
        data: {
          language: 'pl',
          original: parsed.original,
          translation: parsed.translation,
          pronunciation: parsed.pronunciation,
          exampleSentence: parsed.exampleSentence,
          exampleTranslation: parsed.exampleTranslation,
          groups: {
            create: groupNames.map((name) => ({
              group: {
                connectOrCreate: {
                  where: { language_name: { language: 'pl', name } },
                  create: { language: 'pl', name },
                },
              },
            })),
          },
        },
      });
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
      `☀️ Всего солнышек: ${overview.gems}`,
      `🏆 Максимальный streak: ${overview.maxStreak}`,
    ].join('\n'),
    { keyboard: new InlineKeyboard().text('⬅️ Назад', cb(CB.admin, 'menu')) },
  );
});

adminComposer.callbackQuery(cb(CB.admin, 'activity'), async (ctx) => {
  await ack(ctx);
  const { sessions, answers } = await statsService.getRecentActivity(ctx.user.id);

  const lines = ['🕓 <b>Тренировки за неделю (другие игроки)</b>', ''];
  if (!sessions.length) lines.push('Пока нет сессий.');
  for (const session of sessions.slice(0, 30)) {
    const who = escapeHtml(session.user.firstName ?? String(session.user.telegramId));
    const started = session.startedAt.toLocaleString('ru-RU', { timeZone: 'UTC' });
    const status = session.status === 'COMPLETED' ? '✅' : session.status === 'ABANDONED' ? '✖️' : '▶️';
    const duration = session.completedAt
      ? `${Math.max(0, Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 1000))}с`
      : '—';
    lines.push(`${status} ${who} — ${session.correctAnswers}/${session.totalQuestions}, ${duration} (${started})`);
  }
  if (sessions.length > 30) lines.push(`… и ещё ${sessions.length - 30}`);

  lines.push('', '✍️ <b>Последние ответы</b>', '');
  if (!answers.length) lines.push('Пока нет ответов.');
  for (const answer of answers.slice(0, 30)) {
    const who = escapeHtml(answer.user.firstName ?? String(answer.user.telegramId));
    const when = answer.createdAt.toLocaleString('ru-RU', { timeZone: 'UTC' });
    const mark = answer.isCorrect ? '✅' : '❌';
    const responseTime = answer.responseTimeMs != null ? `${Math.round(answer.responseTimeMs / 1000)}с` : '—';
    lines.push(
      `${mark} ${who}: ${escapeHtml(answer.word.original)} — ${escapeHtml(answer.word.translation)} (${answer.grade}, ${responseTime}, ${when})`,
    );
  }
  if (answers.length > 30) lines.push(`… и ещё ${answers.length - 30}`);

  await render(ctx, lines.join('\n'), { keyboard: new InlineKeyboard().text('⬅️ Назад', cb(CB.admin, 'menu')) });
});

adminComposer.callbackQuery(cb(CB.admin, 'users'), async (ctx) => {
  await ack(ctx);
  const users = await prisma.user.findMany({ orderBy: { lastActiveAt: 'desc' }, take: 15 });

  const lines = ['👤 <b>Игроки</b>', ''];
  const keyboard = new InlineKeyboard();
  for (const user of users) {
    lines.push(
      `• ${escapeHtml(user.firstName ?? String(user.telegramId))} (<code>${user.telegramId}</code>) — 🔥${user.currentStreak} / 🏆${user.longestStreak}, ☀️${user.gems}`,
    );
    keyboard.text(`🔥 ${user.firstName ?? user.telegramId}`, cb(CB.admin, 'restore', user.id)).row();
  }

  keyboard.text('⬅️ Назад', cb(CB.admin, 'menu'));
  await render(ctx, lines.join('\n'), { keyboard });
});

adminComposer.callbackQuery(/^adm:restore:([^:]+)$/, async (ctx) => {
  await ack(ctx);
  const userId = ctx.match[1];
  if (!userId) return;

  const user = await streakService.restoreStreak(userId);
  await render(
    ctx,
    `✅ Streak восстановлен для <b>${escapeHtml(user.firstName ?? String(user.telegramId))}</b>: 🔥${user.currentStreak}`,
    { keyboard: new InlineKeyboard().text('⬅️ К игрокам', cb(CB.admin, 'users')) },
  );
});

adminComposer.callbackQuery(cb(CB.admin, 'words'), async (ctx) => {
  await ack(ctx);
  await renderWordManagement(ctx);
});

async function renderWordManagement(ctx: BotContext): Promise<void> {
  const [groups, words] = await Promise.all([
    prisma.wordGroup.findMany({
      where: { language: 'pl' },
      orderBy: { name: 'asc' },
      include: { _count: { select: { words: true } } },
    }),
    prisma.word.findMany({ where: { language: 'pl' }, orderBy: { original: 'asc' }, take: 30 }),
  ]);

  const lines = ['📚 <b>Слова и группы</b>', '', '<b>Группы:</b>'];
  const keyboard = new InlineKeyboard();
  if (!groups.length) lines.push('Пока нет групп.');
  for (const group of groups) {
    lines.push(`• ${escapeHtml(group.name)} — ${group._count.words} слов`);
    keyboard.text(`🗑 ${group.name}`, cb(CB.admin, 'delgroup', group.id)).row();
  }

  lines.push('', '<b>Карточки:</b>');
  if (!words.length) lines.push('Пока нет карточек.');
  for (const word of words) {
    lines.push(`• ${escapeHtml(word.original)} — ${escapeHtml(word.translation)}`);
    keyboard.text(`🗑 ${word.original}`, cb(CB.admin, 'delword', word.id)).row();
  }

  keyboard.text('➕ Добавить слово', cb(CB.admin, 'new', 'word')).row().text('⬅️ Назад', cb(CB.admin, 'menu'));
  await render(ctx, lines.join('\n'), { keyboard });
}

adminComposer.callbackQuery(/^adm:delword:([^:]+)$/, async (ctx) => {
  await ack(ctx);
  const wordId = ctx.match[1];
  if (!wordId) return;
  const word = await prisma.word.findUnique({ where: { id: wordId } });
  if (!word) {
    await ack(ctx, 'Карточка уже удалена', true);
    await renderWordManagement(ctx);
    return;
  }
  await render(ctx, `Удалить карточку <b>${escapeHtml(word.original)}</b> — ${escapeHtml(word.translation)}?`, {
    keyboard: new InlineKeyboard()
      .text('✅ Удалить', cb(CB.admin, 'confirmword', word.id))
      .row()
      .text('⬅️ Назад', cb(CB.admin, 'words')),
  });
});

adminComposer.callbackQuery(/^adm:confirmword:([^:]+)$/, async (ctx) => {
  await ack(ctx, 'Удалено');
  const wordId = ctx.match[1];
  if (wordId) await prisma.word.deleteMany({ where: { id: wordId } });
  await renderWordManagement(ctx);
});

adminComposer.callbackQuery(/^adm:delgroup:([^:]+)$/, async (ctx) => {
  await ack(ctx);
  const groupId = ctx.match[1];
  if (!groupId) return;
  const group = await prisma.wordGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    await ack(ctx, 'Группа уже удалена', true);
    await renderWordManagement(ctx);
    return;
  }
  await render(ctx, `Удалить группу <b>${escapeHtml(group.name)}</b>?\n\nСлова останутся в словаре, удалится только группа и её связи.`, {
    keyboard: new InlineKeyboard()
      .text('✅ Удалить', cb(CB.admin, 'confirmgroup', group.id))
      .row()
      .text('⬅️ Назад', cb(CB.admin, 'words')),
  });
});

adminComposer.callbackQuery(/^adm:confirmgroup:([^:]+)$/, async (ctx) => {
  await ack(ctx, 'Удалено');
  const groupId = ctx.match[1];
  if (groupId) await prisma.wordGroup.deleteMany({ where: { id: groupId } });
  await renderWordManagement(ctx);
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

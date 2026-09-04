import {
  Difficulty,
  PrismaClient,
  QuestMetric,
  QuestPeriod,
  RewardContentType,
  ShopItemType,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed data only contains *content*, never game balance constants —
 * those live in src/config/game.config.ts.
 */

const WORDS = [
  { original: 'cześć', translation: 'привет', pronunciation: 'чещчь', category: 'greetings', difficulty: Difficulty.EASY, exampleSentence: 'Cześć, jak się masz?', exampleTranslation: 'Привет, как дела?' },
  { original: 'dziękuję', translation: 'спасибо', pronunciation: 'дженкуе', category: 'greetings', difficulty: Difficulty.EASY, exampleSentence: 'Dziękuję bardzo!', exampleTranslation: 'Большое спасибо!' },
  { original: 'do widzenia', translation: 'до свидания', pronunciation: 'до видзеня', category: 'greetings', difficulty: Difficulty.EASY, exampleSentence: 'Do widzenia i do zobaczenia!', exampleTranslation: 'До свидания и до встречи!' },
  { original: 'dobranoc', translation: 'спокойной ночи', pronunciation: 'добраноц', category: 'greetings', difficulty: Difficulty.EASY, exampleSentence: 'Dobranoc, śpij dobrze.', exampleTranslation: 'Спокойной ночи, спи сладко.' },
  { original: 'dzień dobry', translation: 'доброе утро', pronunciation: 'дзень добры', category: 'greetings', difficulty: Difficulty.EASY },
  { original: 'dom', translation: 'дом', pronunciation: 'дом', category: 'basics', difficulty: Difficulty.EASY, exampleSentence: 'Mój dom jest mały.', exampleTranslation: 'Мой дом маленький.' },
  { original: 'kot', translation: 'кот', pronunciation: 'кот', category: 'animals', difficulty: Difficulty.EASY, exampleSentence: 'Kot śpi.', exampleTranslation: 'Кот спит.' },
  { original: 'pies', translation: 'собака', pronunciation: 'пес', category: 'animals', difficulty: Difficulty.EASY },
  { original: 'kwiat', translation: 'цветок', pronunciation: 'квят', category: 'nature', difficulty: Difficulty.EASY, exampleSentence: 'Ten kwiat jest dla ciebie.', exampleTranslation: 'Этот цветок для тебя.' },
  { original: 'słońce', translation: 'солнце', pronunciation: 'свонце', category: 'nature', difficulty: Difficulty.EASY },
  { original: 'gwiazda', translation: 'звезда', pronunciation: 'гвязда', category: 'nature', difficulty: Difficulty.MEDIUM },
  { original: 'miłość', translation: 'любовь', pronunciation: 'мивощчь', category: 'feelings', difficulty: Difficulty.EASY, exampleSentence: 'Miłość jest słodka.', exampleTranslation: 'Любовь сладкая.' },
  { original: 'serce', translation: 'сердце', pronunciation: 'серце', category: 'feelings', difficulty: Difficulty.MEDIUM },
  { original: 'uśmiech', translation: 'улыбка', pronunciation: 'ущмех', category: 'feelings', difficulty: Difficulty.MEDIUM },
  { original: 'przytulanie', translation: 'обнимашки', pronunciation: 'пшитуляне', category: 'feelings', difficulty: Difficulty.MEDIUM },
  { original: 'kawa', translation: 'кофе', pronunciation: 'кава', category: 'food', difficulty: Difficulty.EASY },
  { original: 'chleb', translation: 'хлеб', pronunciation: 'хлеб', category: 'food', difficulty: Difficulty.EASY },
  { original: 'ser', translation: 'сыр', pronunciation: 'сер', category: 'food', difficulty: Difficulty.MEDIUM },
  { original: 'czekolada', translation: 'шоколад', pronunciation: 'чеколяда', category: 'food', difficulty: Difficulty.EASY },
  { original: 'ciasto', translation: 'торт', pronunciation: 'цясто', category: 'food', difficulty: Difficulty.MEDIUM },
  { original: 'książka', translation: 'книга', pronunciation: 'кщёнжка', category: 'objects', difficulty: Difficulty.EASY },
  { original: 'podróż', translation: 'путешествие', pronunciation: 'подруж', category: 'travel', difficulty: Difficulty.MEDIUM },
  { original: 'jutro', translation: 'завтра', pronunciation: 'ютро', category: 'time', difficulty: Difficulty.EASY },
  { original: 'zawsze', translation: 'всегда', pronunciation: 'завше', category: 'time', difficulty: Difficulty.MEDIUM },
  { original: 'razem', translation: 'вместе', pronunciation: 'разем', category: 'feelings', difficulty: Difficulty.MEDIUM },
];

const QUESTS = [
  { code: 'daily_words_10', title: 'Выучи 10 слов', description: 'Ответь на 10 карточек', icon: '📚', period: QuestPeriod.DAILY, metric: QuestMetric.WORDS_ANSWERED, target: 10, reward: { currency: 60, xp: 25 } },
  { code: 'daily_correct_15', title: '15 правильных ответов', description: 'Отвечай точно', icon: '🎯', period: QuestPeriod.DAILY, metric: QuestMetric.CORRECT_ANSWERS, target: 15, reward: { currency: 80, xp: 35 } },
  { code: 'daily_session_1', title: 'Заверши тренировку', description: 'Пройди одну сессию до конца', icon: '🏁', period: QuestPeriod.DAILY, metric: QuestMetric.SESSIONS_COMPLETED, target: 1, reward: { currency: 50, xp: 20 } },
  { code: 'daily_xp_100', title: 'Набери 100 XP', description: 'За сегодня', icon: '⭐', period: QuestPeriod.DAILY, metric: QuestMetric.XP_EARNED, target: 100, reward: { currency: 70, xp: 0 } },
  { code: 'daily_bonus', title: 'Забери бонус', description: 'Ежедневная награда', icon: '🎁', period: QuestPeriod.DAILY, metric: QuestMetric.DAILY_BONUS_CLAIMED, target: 1, reward: { currency: 30, xp: 10 } },
  { code: 'weekly_words_100', title: '100 слов за неделю', description: 'Ответь на 100 карточек', icon: '📖', period: QuestPeriod.WEEKLY, metric: QuestMetric.WORDS_ANSWERED, target: 100, reward: { currency: 400, xp: 150 } },
  { code: 'weekly_days_5', title: 'Заходи 5 дней', description: 'Пять активных дней за неделю', icon: '🔥', period: QuestPeriod.WEEKLY, metric: QuestMetric.ACTIVE_DAYS, target: 5, reward: { currency: 500, xp: 200, streakShields: 1 } },
  { code: 'weekly_mastered_5', title: 'Выучи 5 слов полностью', description: 'Доведи слова до статуса «выучено»', icon: '🌟', period: QuestPeriod.WEEKLY, metric: QuestMetric.WORDS_MASTERED, target: 5, reward: { currency: 600, xp: 250 } },
];

const ACHIEVEMENTS = [
  { code: 'first_word', title: 'Первое слово', description: 'Ответь на первую карточку', icon: '🌱', condition: { metric: 'TOTAL_ANSWERS', threshold: 1 }, reward: { currency: 50, xp: 10 }, sortOrder: 10 },
  { code: 'words_100', title: '100 слов', description: 'Ответь на 100 карточек', icon: '📚', condition: { metric: 'TOTAL_ANSWERS', threshold: 100 }, reward: { currency: 200, xp: 80 }, sortOrder: 20 },
  { code: 'words_500', title: '500 слов', description: 'Ответь на 500 карточек', icon: '📖', condition: { metric: 'TOTAL_ANSWERS', threshold: 500 }, reward: { currency: 600, xp: 250 }, sortOrder: 30 },
  { code: 'correct_100', title: '100 правильных', description: '100 верных ответов', icon: '💯', condition: { metric: 'TOTAL_CORRECT_ANSWERS', threshold: 100 }, reward: { currency: 250, xp: 100 }, sortOrder: 40 },
  { code: 'streak_7', title: 'Неделя подряд', description: '7 дней streak', icon: '🔥', condition: { metric: 'LONGEST_STREAK', threshold: 7 }, reward: { currency: 300, xp: 120 }, sortOrder: 50 },
  { code: 'streak_30', title: 'Месяц подряд', description: '30 дней streak', icon: '🔥', condition: { metric: 'LONGEST_STREAK', threshold: 30 }, reward: { currency: 1200, xp: 500, streakShields: 1 }, sortOrder: 60 },
  { code: 'first_level_up', title: 'Первый уровень', description: 'Достигни 2 уровня', icon: '⭐', condition: { metric: 'LEVEL', threshold: 2 }, reward: { currency: 100, xp: 0 }, sortOrder: 70 },
  { code: 'xp_1000', title: '1000 XP', description: 'Набери 1000 XP', icon: '🏆', condition: { metric: 'TOTAL_XP', threshold: 1000 }, reward: { currency: 500, xp: 0 }, sortOrder: 80 },
  { code: 'mastered_10', title: 'Знаток', description: '10 полностью выученных слов', icon: '🌟', condition: { metric: 'WORDS_MASTERED', threshold: 10 }, reward: { currency: 400, xp: 200 }, sortOrder: 90 },
  { code: 'sessions_50', title: 'Постоянство', description: '50 завершённых тренировок', icon: '🏁', condition: { metric: 'SESSIONS_COMPLETED', threshold: 50 }, reward: { currency: 700, xp: 300 }, sortOrder: 100 },
  { code: 'secret_hunter', title: 'Охотница за секретами', description: 'Найди 3 секрета', icon: '💛', condition: { metric: 'EASTER_EGGS_FOUND', threshold: 3 }, reward: { currency: 500, xp: 100 }, isSecret: true, sortOrder: 200 },
];

const SHOP_ITEMS = [
  { code: 'streak_shield', title: 'Щит серии', description: 'Спасёт streak, если пропустишь день', icon: '🛡', price: 300, type: ShopItemType.STREAK_SHIELD, metadata: { amount: 1 }, sortOrder: 10, perUserLimit: null },
  { code: 'streak_shield_x3', title: 'Три щита', description: 'Комплект из трёх щитов, выгоднее', icon: '🛡', price: 800, type: ShopItemType.STREAK_SHIELD, metadata: { amount: 3 }, sortOrder: 20, perUserLimit: null },
  { code: 'theme_sakura', title: 'Тема «Сакура»', description: 'Косметика для профиля', icon: '🌸', price: 1000, type: ShopItemType.COSMETIC, metadata: { amount: 1 }, sortOrder: 30, perUserLimit: 1 },
];

const EASTER_EGGS = [
  { code: 'love', title: 'Секретное сообщение', trigger: { kind: 'command', value: '/love' }, contentText: 'Ты самая лучшая. Спасибо, что учишься вместе со мной 💛', reward: { currency: 100, xp: 20 }, contentType: RewardContentType.TEXT },
  { code: 'kocham_cie', title: 'Kocham Cię', trigger: { kind: 'phrase', value: 'kocham cię' }, contentText: 'Ja też Cię kocham ❤️', reward: { currency: 150, xp: 30 }, contentType: RewardContentType.TEXT },
  { code: 'streak_7_secret', title: 'Неделя вместе', trigger: { kind: 'streak', value: 7 }, contentText: 'Целая неделя подряд! Я тобой горжусь 🌸', reward: { currency: 200, xp: 50 }, contentType: RewardContentType.TEXT },
];

async function main(): Promise<void> {
  const language = process.env.DEFAULT_LEARNING_LANGUAGE ?? 'pl';

  for (const word of WORDS) {
    await prisma.word.upsert({
      where: { language_original_translation: { language, original: word.original, translation: word.translation } },
      create: { ...word, language },
      update: { ...word, language },
    });
  }

  for (const quest of QUESTS) {
    await prisma.quest.upsert({ where: { code: quest.code }, create: quest, update: quest });
  }

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      create: achievement,
      update: achievement,
    });
  }

  for (const item of SHOP_ITEMS) {
    await prisma.shopItem.upsert({ where: { code: item.code }, create: item, update: item });
  }

  for (const egg of EASTER_EGGS) {
    await prisma.easterEgg.upsert({ where: { code: egg.code }, create: egg, update: egg });
  }

  console.log(
    `Seed complete: ${WORDS.length} words, ${QUESTS.length} quests, ${ACHIEVEMENTS.length} achievements, ` +
      `${SHOP_ITEMS.length} shop items, ${EASTER_EGGS.length} easter eggs.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

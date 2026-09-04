import {
  Difficulty,
  PrismaClient,
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

async function main(): Promise<void> {
  const language = process.env.DEFAULT_LEARNING_LANGUAGE ?? 'pl';

  for (const word of WORDS) {
    await prisma.word.upsert({
      where: { language_original_translation: { language, original: word.original, translation: word.translation } },
      create: { ...word, language },
      update: { ...word, language },
    });
  }

  console.log(`Seed complete: ${WORDS.length} words.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

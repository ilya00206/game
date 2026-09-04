import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed data only contains *content*, never game balance constants —
 * those live in src/config/game.config.ts.
 * Intentionally empty: fill in words/groups here as needed.
 */
const WORDS: Array<{
  original: string;
  translation: string;
  pronunciation?: string;
  groups: string[];
  exampleSentence?: string;
  exampleTranslation?: string;
}> = [
  { original: 'poniedziałek', translation: 'понедельник', groups: ['Дни недели и время'] },
  { original: 'wtorek', translation: 'вторник', groups: ['Дни недели и время'] },
  { original: 'środa', translation: 'среда', groups: ['Дни недели и время'] },
  { original: 'czwartek', translation: 'четверг', groups: ['Дни недели и время'] },
  { original: 'piątek', translation: 'пятница', groups: ['Дни недели и время'] },
  { original: 'sobota', translation: 'суббота', groups: ['Дни недели и время'] },
  { original: 'niedziela', translation: 'воскресенье', groups: ['Дни недели и время'] },
  { original: 'dzisiaj', translation: 'сегодня', groups: ['Дни недели и время'] },
  { original: 'jutro', translation: 'завтра', groups: ['Дни недели и время'] },
  { original: 'wczoraj', translation: 'вчера', groups: ['Дни недели и время'] },
  { original: 'teraz', translation: 'сейчас', groups: ['Дни недели и время'] },
  { original: 'rano', translation: 'утром', groups: ['Дни недели и время'] },
  { original: 'wieczór', translation: 'вечер', groups: ['Дни недели и время'] },
  { original: 'noc', translation: 'ночь', groups: ['Дни недели и время'] },
  { original: 'czas', translation: 'время', groups: ['Дни недели и время'] },
  { original: 'godzina', translation: 'час', groups: ['Дни недели и время'] },
  { original: 'minuta', translation: 'минута', groups: ['Дни недели и время'] },
  { original: 'tydzień', translation: 'неделя', groups: ['Дни недели и время'] },
  { original: 'weekend', translation: 'выходные', groups: ['Дни недели и время'] },
  { original: 'sekunda', translation: 'секунда', groups: ['Дни недели и время'] },
  { original: 'doba', translation: 'сутки', groups: ['Дни недели и время'] },
  { original: 'biały', translation: 'белый', groups: ['Цвета'] },
  { original: 'czarny', translation: 'чёрный', groups: ['Цвета'] },
  { original: 'czerwony', translation: 'красный', groups: ['Цвета'] },
  { original: 'niebieski', translation: 'синий / голубой', groups: ['Цвета'] },
  { original: 'zielony', translation: 'зелёный', groups: ['Цвета'] },
  { original: 'żółty', translation: 'жёлтый', groups: ['Цвета'] },
  { original: 'pomarańczowy', translation: 'оранжевый', groups: ['Цвета'] },
  { original: 'różowy', translation: 'розовый', groups: ['Цвета'] },
  { original: 'fioletowy', translation: 'фиолетовый', groups: ['Цвета'] },
  { original: 'brązowy', translation: 'коричневый', groups: ['Цвета'] },
  { original: 'szary', translation: 'серый', groups: ['Цвета'] },
  { original: 'Cześć!', translation: 'Привет! / Пока!', groups: ['Приветствия и вежливые слова'] },
  { original: 'Dzień dobry!', translation: 'Добрый день! / Здравствуйте!', groups: ['Приветствия и вежливые слова'] },
  { original: 'Dobry wieczór!', translation: 'Добрый вечер!', groups: ['Приветствия и вежливые слова'] },
  { original: 'Do widzenia!', translation: 'До свидания!', groups: ['Приветствия и вежливые слова'] },
  { original: 'Do zobaczenia!', translation: 'До встречи!', groups: ['Приветствия и вежливые слова'] },
  { original: 'Do jutra!', translation: 'До завтра!', groups: ['Приветствия и вежливые слова'] },
  { original: 'Dobranoc!', translation: 'Спокойной ночи!', groups: ['Приветствия и вежливые слова'] },
  { original: 'Hej!', translation: 'Привет! / Эй!', groups: ['Приветствия и вежливые слова'] },
  { original: 'proszę', translation: 'пожалуйста', groups: ['Приветствия и вежливые слова'] },
  { original: 'dziękuję', translation: 'спасибо', groups: ['Приветствия и вежливые слова'] },
  { original: 'dzięki', translation: 'спасибо (неформально)', groups: ['Приветствия и вежливые слова'] },
  { original: 'bardzo dziękuję', translation: 'большое спасибо', groups: ['Приветствия и вежливые слова'] },
  { original: 'przepraszam', translation: 'извините / простите', groups: ['Приветствия и вежливые слова'] },
  { original: 'przepraszam bardzo', translation: 'очень извиняюсь / простите', groups: ['Приветствия и вежливые слова'] },
  { original: 'nie ma za co', translation: 'не за что', groups: ['Приветствия и вежливые слова'] },
  { original: 'proszę bardzo', translation: 'пожалуйста / не за что', groups: ['Приветствия и вежливые слова'] },
  { original: 'tak', translation: 'да', groups: ['Приветствия и вежливые слова'] },
  { original: 'nie', translation: 'нет', groups: ['Приветствия и вежливые слова'] },
  { original: 'oczywiście', translation: 'конечно', groups: ['Приветствия и вежливые слова'] },
  { original: 'Miło mi.', translation: 'Очень приятно.', groups: ['Приветствия и вежливые слова'] },
  { original: 'chleb', translation: 'хлеб', groups: ['Еда'] },
  { original: 'ser', translation: 'сыр', groups: ['Еда'] },
  { original: 'jajko', translation: 'яйцо', groups: ['Еда'] },
  { original: 'mleko', translation: 'молоко', groups: ['Еда'] },
  { original: 'masło', translation: 'масло', groups: ['Еда'] },
  { original: 'mięso', translation: 'мясо', groups: ['Еда'] },
  { original: 'kurczak', translation: 'курица', groups: ['Еда'] },
  { original: 'ryba', translation: 'рыба', groups: ['Еда'] },
  { original: 'zupa', translation: 'суп', groups: ['Еда'] },
  { original: 'ziemniak', translation: 'картофель', groups: ['Еда'] },
  { original: 'ryż', translation: 'рис', groups: ['Еда'] },
  { original: 'makaron', translation: 'макароны', groups: ['Еда'] },
  { original: 'jabłko', translation: 'яблоко', groups: ['Еда'] },
  { original: 'banan', translation: 'банан', groups: ['Еда'] },
  { original: 'pomidor', translation: 'помидор', groups: ['Еда'] },
  { original: 'ogórek', translation: 'огурец', groups: ['Еда'] },
  { original: 'cebula', translation: 'лук', groups: ['Еда'] },
  { original: 'marchewka', translation: 'морковь', groups: ['Еда'] },
  { original: 'woda', translation: 'вода', groups: ['Еда'] },
  { original: 'kawa', translation: 'кофе', groups: ['Еда'] },
  { original: 'herbata', translation: 'чай', groups: ['Еда'] },
  { original: 'sok', translation: 'сок', groups: ['Еда'] },
  { original: 'cukier', translation: 'сахар', groups: ['Еда'] },
  { original: 'sól', translation: 'соль', groups: ['Еда'] },
  { original: 'śniadanie', translation: 'завтрак', groups: ['Еда'] },
  { original: 'obiad', translation: 'обед', groups: ['Еда'] },
  { original: 'kolacja', translation: 'ужин', groups: ['Еда'] },
  { original: 'menu', translation: 'меню', groups: ['Еда'] },
  { original: 'rachunek', translation: 'счёт', groups: ['Еда'] },
  { original: 'pyszny', translation: 'очень вкусный', groups: ['Еда'] },
];

async function main(): Promise<void> {
  const language = process.env.DEFAULT_LEARNING_LANGUAGE ?? 'pl';

  for (const word of WORDS) {
    const { groups, ...wordData } = word;
    const groupNames = groups;
    await prisma.word.upsert({
      where: { language_original_translation: { language, original: word.original, translation: word.translation } },
      create: {
        ...wordData,
        language,
        groups: {
          create: groupNames.map((name) => ({
            group: { connectOrCreate: { where: { language_name: { language, name } }, create: { language, name } } },
          })),
        },
      },
      update: { ...wordData, language },
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

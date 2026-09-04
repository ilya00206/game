# 🌸 Lingua Quest Bot

Telegram-бот для изучения иностранного языка в формате уютной игры: карточки, интервальное
повторение, streak, XP и уровни, внутриигровая валюта с полноценным ledger, квесты,
достижения, магазин, ежедневные бонусы и персональные награды от администратора.

---

## Стек

| Слой | Технология |
| --- | --- |
| Runtime | Node.js 20+, TypeScript |
| Telegram | grammY |
| База данных | PostgreSQL |
| ORM | Prisma |
| Валидация | Zod |
| Логи | pino |
| Деплой | Railway |

---

## Архитектура

```text
Telegram handlers  (src/bot)
        ↓
Services           (src/services)   ← вся игровая логика
        ↓
Prisma / Repositories (src/db)
        ↓
PostgreSQL
```

Дополнительно работает внутренняя шина игровых событий (`src/events`): сервисы публикуют
факты (`WORD_ANSWERED`, `SESSION_COMPLETED`, `STREAK_UPDATED`, …), а квесты, достижения и
аналитика подписываются на них. Благодаря этому новая механика не требует правок в
learning/streak/economy.

Ключевые модули:

```text
src/config/game.config.ts      все игровые числа (нет magic numbers в логике)
src/services/economy.service.ts    ledger: любое изменение баланса = транзакция
src/services/reward.service.ts     единая точка выдачи наград
src/services/srs/                  подменяемый алгоритм интервального повторения
src/services/exercise/             реестр типов упражнений
```

---

## Установка (локально)

```bash
git clone <repo>
cd lingua-quest-bot
npm install
cp .env.example .env      # заполнить BOT_TOKEN, DATABASE_URL, ADMIN_TELEGRAM_ID
npm run db:migrate        # создаст схему и применит миграции
npm run db:seed           # слова, квесты, достижения, магазин, пасхалки
npm run dev
```

### Environment variables

| Переменная | Обязательна | Описание |
| --- | --- | --- |
| `BOT_TOKEN` | да | токен от @BotFather |
| `DATABASE_URL` | да | строка подключения PostgreSQL |
| `ADMIN_TELEGRAM_ID` | да | числовой Telegram id администратора |
| `NODE_ENV` | нет | `development` / `production` |
| `LOG_LEVEL` | нет | уровень pino, по умолчанию `info` |
| `PORT` | нет | порт health-check сервера |
| `BOT_MODE` | нет | `polling` (по умолчанию) или `webhook` |
| `WEBHOOK_URL` | при webhook | публичный https-адрес деплоя |
| `WEBHOOK_SECRET` | нет | secret token для проверки webhook |
| `DEFAULT_TIMEZONE` | нет | таймзона новых пользователей |
| `DEFAULT_LEARNING_LANGUAGE` | нет | язык изучения по умолчанию |
| `CURRENCY_NAME`, `CURRENCY_SYMBOL` | нет | название и символ валюты |
| `EASTER_EGGS_ENABLED` | нет | включить слой пасхалок |

Секреты никогда не коммитятся: `.env` в `.gitignore`, логи редактируют токены.

---

## База данных

```bash
npm run db:migrate     # dev-миграции
npm run db:deploy      # production (используется в npm start)
npm run db:studio      # Prisma Studio
npm run db:seed        # наполнение контентом
```

Основные сущности: `User`, `Word`, `UserWord`, `LearningSession`, `LearningAnswer`,
`EconomyTransaction`, `ShopItem`, `Purchase`, `InventoryItem`, `Quest`, `UserQuest`,
`Achievement`, `UserAchievement`, `Reward`, `RewardPurchase`, `DailyBonusClaim`,
`DailyActivity`, `NotificationSettings`, `GameEventLog`, `EasterEgg`, `UserEasterEgg`.

---

## Production / Railway

1. Создать проект на Railway и добавить плагин **PostgreSQL** — он выдаст `DATABASE_URL`.
2. Подключить репозиторий как сервис.
3. Заполнить переменные окружения из таблицы выше (`BOT_TOKEN`, `ADMIN_TELEGRAM_ID`,
   `NODE_ENV=production`).
4. Build command: `npm run build`, start command: `npm start`.
   `npm start` сам выполняет `prisma migrate deploy` перед запуском.
5. Health check: `GET /health` (Railway использует переменную `PORT`).
6. Для webhook-режима задать `BOT_MODE=webhook`, `WEBHOOK_URL=https://<домен>` и
   `WEBHOOK_SECRET`; Telegram будет обращаться на `POST /telegram`.

Локальная файловая система не используется: весь прогресс и весь контент в PostgreSQL.

---

## Админка

Доступна только пользователю с `ADMIN_TELEGRAM_ID`.

```text
⚙️ Admin
├── 👤 Users        просмотр и поиск игроков
├── 📚 Words        добавление / редактирование / деактивация слов
├── 🎯 Quests       список квестов
├── 🏆 Achievements список достижений
├── 🛍 Shop         товары магазина
├── 🎁 Rewards      создание персональных наград с любым контентом
└── 📊 Statistics   сводка по игре и аудит экономики
```

Награды и цены создаются данными, а не кодом.

---

## Гарантии надёжности

- каждое изменение баланса создаёт запись в `EconomyTransaction`;
- операции с наградами несут `idempotencyKey` — повторный Telegram update ничего не удваивает;
- `SELECT ... FOR UPDATE` + одна PostgreSQL-транзакция на критический путь;
- уникальные ключи защищают daily bonus (`userId + localDay`), ответы сессии
  (`sessionId + position`), достижения (`userId + achievementId`), квесты
  (`userId + questId + periodKey`);
- баланс не может уйти в минус;
- callback data содержит только идентификаторы: цены и награды читаются из БД.

---

## Скрипты

```bash
npm run dev         # tsx watch
npm run build       # prisma generate + tsc
npm start           # migrate deploy + node dist/src/index.js
npm run typecheck   # tsc --noEmit
```

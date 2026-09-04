# 🌸 Lingua Quest Bot

Telegram-бот для изучения иностранного языка: карточки, интервальное повторение, streak и солнышки.

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

Ключевые модули:

```text
src/config/game.config.ts      настройки тренировок и награды в солнышках
src/services/streak.service.ts     учёт ежедневной серии
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
npm run db:seed        # слова
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
| `CURRENCY_NAME`, `CURRENCY_SYMBOL` | нет | название и символ солнышек |

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
`DailyActivity`, `NotificationSettings`.

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
└── 📊 Statistics   сводка по игре
```

За каждый правильный ответ игрок получает одно солнышко.

---

## Гарантии надёжности

- уникальный ключ ответа (`sessionId + position`) защищает от повторной обработки Telegram update;
- одна завершённая тренировка начисляет её солнышки только один раз;
- streak обновляется в PostgreSQL-транзакции, поэтому параллельные тренировки не удваивают серию.

---

## Скрипты

```bash
npm run dev         # tsx watch
npm run build       # prisma generate + tsc
npm start           # migrate deploy + node dist/src/index.js
npm run typecheck   # tsc --noEmit
```

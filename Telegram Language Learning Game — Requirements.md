# Telegram Language Learning Game — Requirements

## 1. Цель проекта

Разработать Telegram-бота для изучения иностранного языка в формате игровой системы.

Основная цель — сделать обучение **регулярным, приятным и затягивающим**, чтобы пользователю хотелось возвращаться каждый день.

Бот должен сочетать:

- flashcards;
- spaced repetition;
- ежедневные задания;
- streak;
- XP и уровни;
- внутриигровую валюту;
- достижения;
- ежедневные награды;
- квесты;
- прогрессию;
- персональные события;
- магазин;
- персональные подарки/награды от администратора.

Важно: это **не клон Duolingo**. Главный акцент — на уютной игре, ощущении прогресса и персональной мотивации.

---

# 2. Технологический стек

Использовать:

- Node.js
- TypeScript
- grammY для Telegram Bot API
- PostgreSQL
- Prisma ORM
- Zod для валидации
- Railway для production deployment

Проект должен быть полностью пригоден для деплоя на Railway.

Использовать environment variables:

```env
BOT_TOKEN=
DATABASE_URL=
ADMIN_TELEGRAM_ID=
NODE_ENV=
```

Не хранить секреты в коде.

---

# 3. Архитектурные принципы

Код должен быть модульным.

Не складывать всю логику в Telegram handlers.

Разделить:

```text
Telegram handlers
        ↓
Services
        ↓
Repositories / Prisma
        ↓
PostgreSQL
```

Игровая логика должна находиться в services, а не внутри callback handlers.

Например:

```text
streak.service.ts
economy.service.ts
learning.service.ts
quest.service.ts
achievement.service.ts
reward.service.ts
```

Это позволит в дальнейшем менять Telegram UI, не переписывая игровую механику.

---

# 4. Пользователь

При `/start` создать пользователя, если его ещё нет.

User должен содержать как минимум:

- id
- telegramId
- username
- firstName
- language
- timezone
- createdAt
- lastActiveAt
- currentStreak
- longestStreak
- xp
- level
- balance
- dailyBonusClaimedAt

Timezone должна быть отдельным полем.

Нельзя полагаться только на UTC при расчёте ежедневных механик.

---

# 5. Главное меню

Главное меню:

```text
📚 Учиться
🎯 Задания
🎁 Бонус
📊 Прогресс
🛍 Магазин
🏆 Достижения
👤 Профиль
```

Можно использовать inline keyboards.

UI должен быть компактным и приятным для Telegram.

---

# 6. Learning System

Главная механика — карточки со словами.

Каждое слово:

- original
- translation
- pronunciation
- exampleSentence
- exampleTranslation
- audio
- difficulty
- language
- category
- tags

Дополнительно:

```text
createdAt
updatedAt
```

---

# 7. User Word Progress

У каждого пользователя должен быть отдельный прогресс по каждому слову.

Например:

```text
UserWord

userId
wordId

status
learningLevel

correctAnswers
wrongAnswers

lastReviewedAt
nextReviewAt

consecutiveCorrect
consecutiveWrong

easeFactor
interval

createdAt
updatedAt
```

---

# 8. Spaced Repetition

Не показывать пользователю случайные слова постоянно.

Использовать систему интервального повторения.

Минимальная логика:

```text
New
↓
Learning
↓
Familiar
↓
Known
↓
Mastered
```

Пример:

```text
Не знаю
→ повторить сегодня

Сложно
→ повторить через 1 день

Нормально
→ через 3 дня

Легко
→ через 7 дней

Легко повторно
→ через 14 дней

→ 30 дней
→ 60 дней
```

Алгоритм должен быть вынесен в отдельный service.

Не привязывать алгоритм к Telegram.

В будущем должна быть возможность заменить алгоритм на SM-2/FSRS или другую систему.

---

# 9. Форматы упражнений

Не ограничиваться одной карточкой.

Поддержать архитектуру для нескольких типов заданий:

### Flashcard

Показать:

```text
bonjour

[Показать перевод]
```

После показа:

```text
😵 Не знаю
🤔 Сложно
🙂 Знаю
😍 Легко
```

### Multiple choice

```text
bonjour

Что это значит?

🇷🇺 Привет
🇷🇺 Спасибо
🇷🇺 Пока
🇷🇺 Доброе утро
```

### Translation

Пользователь должен ввести перевод.

### Reverse

Показывается перевод → нужно вспомнить оригинальное слово.

Архитектура должна позволять добавлять новые exercise types без переписывания learning system.

---

# 10. Daily Session

Каждый день пользователю предлагается короткая сессия.

Например:

```text
🌸 Сегодняшняя тренировка

10 новых/повторяемых слов

≈ 5 минут

Награды:
XP
валюта
progress
```

Количество слов должно быть конфигурируемым.

После завершения:

```text
🎉 Тренировка завершена!

10/10 слов
8 правильных
2 требуют повторения

+XP
+currency

🔥 Streak продолжается!
```

---

# 11. Streak

Streak — одна из главных игровых механик.

Пользователь получает streak за выполнение минимальной дневной активности.

Например:

```text
минимум 1 завершённая learning session в день
```

Хранить:

- currentStreak
- longestStreak
- lastActivityDate

Важно корректно обработать:

- новый день;
- несколько тренировок в один день;
- пропуск;
- timezone;
- переход через полночь;
- повторное выполнение.

Нельзя начислять streak несколько раз за один день.

---

# 12. Streak Milestones

Архитектура должна поддерживать milestones:

```text
3 days
7 days
14 days
30 days
50 days
100 days
365 days
```

Но конкретные награды НЕ хардкодить.

Награды должны быть конфигурируемыми.

---

# 13. Streak Protection

Поддержать механику защиты streak.

Например:

```text
Streak Shield
```

Если пользователь пропустил день, shield может автоматически защитить streak.

Количество shield:

```text
streakShields
```

Механика должна быть частью economy/reward system.

Не привязывать конкретную стоимость к коду.

---

# 14. XP

Отдельно от валюты использовать XP.

XP показывает прогресс пользователя.

Пример:

```text
100 XP
250 XP
500 XP
1000 XP
...
```

У пользователя:

```text
totalXp
level
```

Уровень рассчитывается по конфигурируемой формуле/таблице.

Не использовать жёстко заданную формулу внутри handlers.

---

# 15. Levels

Добавить систему уровней.

Пример:

```text
Level 1
Level 2
Level 3
...
```

В профиле:

```text
🌱 Level 8

████████░░ 820 / 1000 XP

До следующего уровня: 180 XP
```

Система должна поддерживать:

- level-up;
- событие level-up;
- reward trigger;
- уведомление пользователя.

Награды за уровни должны быть конфигурируемыми.

---

# 16. Economy

В игре должна существовать отдельная внутриигровая валюта.

Например:

```text
💎
```

Название и символ должны быть конфигурируемыми.

КРИТИЧЕСКИ ВАЖНО:

Не делать:

```typescript
user.balance += 100
```

без записи операции.

Использовать ledger/transaction system.

Например:

```text
EconomyTransaction

id
userId
amount
type
reason
metadata
createdAt
```

Примеры:

```text
+100 daily_bonus
+50 lesson_completed
+20 quest_completed
-300 streak_shield
-500 shop_purchase
```

---

# 17. Economy Rules

Каждое изменение баланса должно создавать transaction.

Transactions должны быть:

- атомарными;
- идемпотентными там, где это необходимо;
- защищёнными от повторного выполнения callback;
- пригодными для аудита.

Нельзя допускать:

```text
double click
↓
двойная награда
```

или:

```text
повторный Telegram update
↓
двойное начисление
```

---

# 18. Economy Balance

Можно хранить текущий balance для быстрого доступа.

Но каждая операция всё равно должна попадать в ledger.

При критических операциях:

```text
transaction DB
    ↓
check balance
    ↓
create economy transaction
    ↓
update balance
```

Всё должно происходить в одной PostgreSQL transaction.

---

# 19. Daily Bonus

Каждый день пользователь может получить daily bonus.

Механика:

```text
Day 1
Day 2
Day 3
...
Day 7
```

Поддержать циклическую или milestone-based систему.

Например:

```text
dailyBonusStreak
lastDailyBonusAt
```

Но конкретные награды не хардкодить.

Система должна работать через reward configuration.

---

# 20. Quests

Добавить ежедневные и недельные задания.

Примеры:

```text
📚 Выучи 10 слов

🎯 Сделай 20 правильных ответов

🔥 Зайди 3 дня подряд

⭐ Получи 500 XP
```

Quest должен иметь:

```text
id
type
title
description
target
progress
period
expiresAt
reward
```

Поддержать:

- daily quests;
- weekly quests;
- future long-term quests.

Quest progress должен обновляться автоматически после соответствующих событий.

---

# 21. Event-based Game System

Рекомендуется создать внутреннюю систему игровых событий.

Например:

```text
WORD_ANSWERED
WORD_MASTERED
SESSION_COMPLETED
DAILY_ACTIVITY_COMPLETED
STREAK_UPDATED
LEVEL_UP
QUEST_PROGRESS
ACHIEVEMENT_UNLOCKED
DAILY_BONUS_CLAIMED
```

Services должны реагировать на события.

Например:

```text
WORD_ANSWERED
   ↓
update learning progress
   ↓
update quest progress
   ↓
award XP
   ↓
maybe award currency
   ↓
check achievements
```

Это позволит расширять игру без огромного количества связанных условий.

---

# 22. Achievements

Добавить achievements.

Примеры:

```text
🌱 Первое слово
📚 100 слов
📖 500 слов
🔥 7 дней streak
🔥 30 дней streak
💯 100 правильных ответов
⭐ Первый level-up
🏆 1000 XP
```

Achievement должен иметь:

```text
id
code
title
description
icon
condition
reward
```

Пользователь:

```text
UserAchievement

userId
achievementId
unlockedAt
```

Achievement должен выдаваться только один раз.

---

# 23. Profile

Профиль:

```text
👤 Профиль

🔥 Streak: 12
🏆 Best streak: 27

⭐ Level: 8
XP: 820

📚 Слов изучено: 347
🎯 Правильных ответов: 1240

💎 Balance: 1840

🏅 Достижения: 14/30
```

---

# 24. Progress

Отдельный экран прогресса.

Показать:

- изученные слова;
- слова в процессе;
- mastered words;
- accuracy;
- sessions completed;
- total learning time;
- streak;
- weekly activity;
- XP.

Можно показывать простую текстовую визуализацию:

```text
Эта неделя

Пн  ████
Вт  ██████
Ср  ███
Чт  ███████
Пт  █████
Сб  ██
Вс  -
```

---

# 25. Shop

Магазин должен быть универсальным.

```text
ShopItem

id
code
title
description
price
currency
type
metadata
isActive
```

Типы предметов не хардкодить только в Telegram UI.

Например:

```text
STREAK_SHIELD
XP_BOOST
COSMETIC
SPECIAL_REWARD
CUSTOM_REWARD
```

Покупка должна происходить через economy transaction.

Если balance недостаточен:

```text
❌ Недостаточно валюты

Нужно: 500 💎
У тебя: 320 💎
```

---

# 26. Personal Rewards

Предусмотреть специальный тип reward, который администратор может создавать самостоятельно.

Например:

```text
🎁 Personal Reward

title
description
price
content
```

Content может быть:

- текст;
- фото;
- видео;
- Telegram message;
- любой другой поддерживаемый тип контента.

Пользователь покупает reward → reward открывается.

---

# 27. Admin Mode

Только `ADMIN_TELEGRAM_ID` имеет доступ.

Admin menu:

```text
⚙️ Admin

👤 Users
📚 Words
🎯 Quests
🏆 Achievements
🛍 Shop
🎁 Rewards
📊 Statistics
```

---

# 28. Word Management

Admin должен иметь возможность:

- добавить слово;
- изменить слово;
- удалить/деактивировать слово;
- добавить перевод;
- добавить пример;
- назначить category;
- назначить difficulty;
- загрузить audio.

Желательно предусмотреть bulk import слов из JSON/CSV в будущем.

---

# 29. Admin Reward Management

Admin должен иметь возможность создавать reward без изменения кода.

Например:

```text
Create reward

Название:
Цена:
Описание:
Тип:
Контент:
```

Конкретные награды не определять в коде проекта.

---

# 30. Notifications

Бот может отправлять:

```text
🌞 Daily reminder
🔥 Streak reminder
🎁 Daily bonus
🎯 Quest reminder
📚 Learning reminder
```

Но:

- не спамить;
- учитывать timezone;
- дать пользователю возможность отключить reminders.

Настройки:

```text
notificationsEnabled
dailyReminderEnabled
reminderTime
```

---

# 31. Retention / Engagement

Главный продуктовый принцип:

Пользователь должен ощущать:

```text
Я сделал немного
↓
я получил награду
↓
мой персонаж/профиль стал лучше
↓
у меня появился прогресс
↓
завтра хочу продолжить
```

Нужны короткие feedback loops.

После каждого действия пользователь должен понимать результат:

```text
+XP
+💎
🔥 streak
Quest progress
Achievement progress
```

Но не показывать 10 сообщений подряд.

Лучше собирать изменения в один красивый результат.

---

# 32. Anti-frustration

Не делать игру слишком наказующей.

Особенно:

- не сбрасывать весь прогресс;
- не отнимать XP;
- не отнимать изученные слова;
- не делать слишком дорогие базовые механики;
- не заставлять пользователя заходить по несколько раз в день.

Пропуск дня должен быть неприятным, но не разрушительным.

---

# 33. Anti-exploit

Защититься от:

- повторного нажатия кнопки;
- повторного Telegram update;
- повторного claim daily reward;
- повторной покупки;
- повторной выдачи achievement;
- race conditions;
- отрицательного balance.

Все economy operations должны проходить серверную проверку.

Никогда не доверять данным callback payload.

---

# 34. Telegram Callback Security

Callback data не должна содержать доверенные значения вроде:

```text
reward=1000
price=1
admin=true
```

Telegram callback должен содержать только идентификатор действия.

Например:

```text
shop:buy:123
word:answer:456
quest:claim:789
```

Все реальные данные брать из БД.

---

# 35. Idempotency

Особенно важна для:

- daily bonus;
- quest rewards;
- achievement rewards;
- purchases;
- streak updates;
- lesson completion.

Операция должна быть безопасной при повторном вызове.

---

# 36. Database Design

Минимальные сущности:

```text
User
Word
UserWord
LearningSession
LearningAnswer

EconomyTransaction
ShopItem
Purchase

Quest
UserQuest

Achievement
UserAchievement

Reward
RewardPurchase

DailyBonus
```

При необходимости добавить:

```text
NotificationSettings
GameEvent
```

---

# 37. LearningSession

Хранить историю тренировок.

```text
LearningSession

id
userId
startedAt
completedAt

totalQuestions
correctAnswers
wrongAnswers

xpEarned
currencyEarned
```

Это позволит строить статистику.

---

# 38. LearningAnswer

Хранить ответы пользователя:

```text
id
sessionId
userId
wordId
exerciseType
result
responseTime
createdAt
```

Response time опционален, но архитектура должна позволять его хранить.

---

# 39. Reward System

Награды должны быть отдельным abstraction layer.

Например:

```text
RewardService.grant()
```

Reward может дать:

```text
currency
XP
item
streak shield
special content
achievement
```

Не писать:

```text
if (streak === 7) balance += 500
```

внутри streak service.

Вместо этого:

```text
streak milestone reached
↓
RewardService
↓
configured reward
```

---

# 40. Configuration

Игровые параметры должны быть конфигурируемыми.

Например:

```text
daily session size
XP per answer
currency per answer
streak milestones
level thresholds
quest targets
shop prices
daily bonus rewards
```

Не разбрасывать magic numbers по проекту.

---

# 41. UX

Бот должен быть:

- быстрым;
- минималистичным;
- понятным;
- с небольшим количеством сообщений;
- с inline buttons;
- с понятной навигацией назад.

После каждого действия желательно редактировать существующее сообщение вместо создания нового, где это возможно.

Не засорять чат.

---

# 42. Error Handling

Telegram API errors не должны ронять процесс.

Добавить:

- global error handler;
- logging;
- graceful shutdown;
- DB error handling;
- retry для transient errors.

Ошибки пользователю показывать дружелюбно:

```text
😔 Что-то пошло не так.

Попробуй ещё раз.
```

Технические stack traces пользователю не показывать.

---

# 43. Logging

Логировать:

- startup;
- shutdown;
- Telegram errors;
- DB errors;
- economy transactions;
- purchases;
- reward grants;
- important game events.

Не логировать:

- BOT_TOKEN;
- секреты;
- чувствительные данные.

---

# 44. Deployment

Проект должен запускаться на Railway.

Предусмотреть:

```text
npm run build
npm run start
```

Например:

```text
build:
tsc

start:
node dist/index.js
```

Prisma migrations должны быть частью production workflow.

Добавить health check endpoint, если Railway configuration этого требует.

---

# 45. Development

Добавить:

```text
.env.example
README.md
```

README должен содержать:

- installation;
- environment variables;
- database setup;
- Prisma migration;
- local development;
- production deployment;
- Railway setup.

---

# 46. Testing

Покрыть тестами критическую бизнес-логику.

Особенно:

### Streak

Проверить:

- первый день;
- второй день;
- несколько действий за день;
- пропуск;
- timezone;
- streak shield.

### Economy

Проверить:

- начисление;
- списание;
- недостаточный баланс;
- concurrent purchase;
- duplicate transaction.

### Daily bonus

Проверить:

- claim;
- повторный claim;
- следующий день;
- timezone.

### Learning

Проверить:

- правильный ответ;
- неправильный ответ;
- изменение interval;
- nextReviewAt;
- mastery.

### Achievements

Проверить:

- unlock;
- duplicate unlock.

---

# 47. Important Product Rule

Не пытаться сразу сделать 100 механик.

MVP должен быть очень хорошо отполирован.

MVP:

```text
/start
↓
profile
↓
daily learning
↓
flashcards
↓
spaced repetition
↓
XP
↓
currency
↓
streak
↓
daily bonus
↓
quests
↓
shop
↓
achievements
```

После того как это стабильно работает, добавлять:

```text
levels
special events
personal rewards
cosmetics
leaderboards
collections
more exercise types
```

---

# 48. Extensibility

Архитектура должна позволять без серьёзного рефакторинга добавить:

- несколько языков;
- несколько пользователей;
- новые валюты;
- новые типы reward;
- новые типы quests;
- новые achievements;
- новые exercise types;
- premium mechanics;
- seasonal events;
- leaderboard;
- collections;
- cosmetic items.

---

# 49. Что НЕ делать

Не делать:

- монолитный `bot.ts` на тысячи строк;
- бизнес-логику в callback handlers;
- hardcoded rewards;
- hardcoded shop prices;
- прямое изменение balance без ledger;
- доверие callback payload;
- хранение прогресса только в Telegram;
- зависимости от локальной файловой системы;
- SQLite для production;
- секреты в git;
- синхронные долгие операции внутри Telegram update;
- спам сообщениями.

---

# 50. Definition of Done

MVP считается готовым, если:

1. Бот запускается локально.
2. Бот запускается на Railway.
3. PostgreSQL подключён.
4. Prisma migrations работают.
5. Пользователь создаётся через `/start`.
6. Пользователь может пройти learning session.
7. Ответы сохраняются.
8. Spaced repetition работает.
9. Streak корректно считается.
10. XP начисляется.
11. Currency начисляется через ledger.
12. Daily bonus нельзя забрать дважды.
13. Quests работают.
14. Achievements работают.
15. Shop работает.
16. Покупки атомарны.
17. Есть admin mode.
18. Admin может добавлять слова.
19. Admin может создавать rewards.
20. Есть error handling.
21. Есть logging.
22. Критическая бизнес-логика покрыта тестами.
23. Нет magic numbers в бизнес-логике.
24. Проект имеет README.
25. Проект можно полностью развернуть на чистом Railway environment.

---

# 51. Главный критерий качества

При принятии архитектурных решений всегда отдавать приоритет:

**1. Надёжность экономики**

**2. Качественному learning loop**

**3. Retention / мотивации**

**4. Простоте UX**

**5. Расширяемости**

Не жертвовать целостностью экономики ради простоты реализации.

Игра должна ощущаться как маленький законченный продукт, а не как техническая демонстрация Telegram Bot API.

Так же эта игра предназначена только для моей девушки, единственной и неповторимой. Так что буду хотеть много пасхалок для нее добавить
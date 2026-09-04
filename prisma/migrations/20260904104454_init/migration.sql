-- CreateEnum
CREATE TYPE "WordStatus" AS ENUM ('NEW', 'LEARNING', 'FAMILIAR', 'KNOWN', 'MASTERED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('FLASHCARD', 'MULTIPLE_CHOICE', 'TRANSLATION', 'REVERSE');

-- CreateEnum
CREATE TYPE "AnswerGrade" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "QuestPeriod" AS ENUM ('DAILY', 'WEEKLY', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "QuestMetric" AS ENUM ('WORDS_ANSWERED', 'CORRECT_ANSWERS', 'WORDS_MASTERED', 'SESSIONS_COMPLETED', 'XP_EARNED', 'ACTIVE_DAYS', 'DAILY_BONUS_CLAIMED');

-- CreateEnum
CREATE TYPE "UserQuestStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShopItemType" AS ENUM ('STREAK_SHIELD', 'XP_BOOST', 'COSMETIC', 'SPECIAL_REWARD', 'PERSONAL_REWARD');

-- CreateEnum
CREATE TYPE "RewardContentType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'ANIMATION', 'DOCUMENT', 'AUDIO', 'VOICE', 'STICKER');

-- CreateEnum
CREATE TYPE "GameEventType" AS ENUM ('USER_REGISTERED', 'WORD_ANSWERED', 'WORD_MASTERED', 'SESSION_STARTED', 'SESSION_COMPLETED', 'DAILY_ACTIVITY_COMPLETED', 'STREAK_UPDATED', 'STREAK_MILESTONE_REACHED', 'LEVEL_UP', 'QUEST_PROGRESS', 'QUEST_COMPLETED', 'QUEST_CLAIMED', 'ACHIEVEMENT_UNLOCKED', 'DAILY_BONUS_CLAIMED', 'SHOP_PURCHASE', 'REWARD_GRANTED', 'EASTER_EGG_FOUND');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "learningLanguage" TEXT NOT NULL DEFAULT 'pl',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "streakShields" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDay" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "streakFrozenDays" INTEGER NOT NULL DEFAULT 0,
    "dailyBonusStreak" INTEGER NOT NULL DEFAULT 0,
    "dailyBonusDay" TEXT,
    "dailyBonusClaimedAt" TIMESTAMP(3),
    "totalAnswers" INTEGER NOT NULL DEFAULT 0,
    "totalCorrectAnswers" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalLearningSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "streakReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "questReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderTime" TEXT NOT NULL DEFAULT '19:00',
    "lastDailyReminderDay" TEXT,
    "lastStreakReminderDay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "pronunciation" TEXT,
    "exampleSentence" TEXT,
    "exampleTranslation" TEXT,
    "audioFileId" TEXT,
    "imageFileId" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "status" "WordStatus" NOT NULL DEFAULT 'NEW',
    "learningLevel" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "consecutiveWrong" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetition" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "masteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "plannedWordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "currencyEarned" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "localDay" TEXT NOT NULL,

    CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "exerciseType" "ExerciseType" NOT NULL,
    "grade" "AnswerGrade" NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDay" TEXT NOT NULL,
    "answers" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🛍',
    "price" INTEGER NOT NULL,
    "type" "ShopItemType" NOT NULL,
    "metadata" JSONB,
    "perUserLimit" INTEGER,
    "stock" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🎯',
    "period" "QuestPeriod" NOT NULL,
    "metric" "QuestMetric" NOT NULL,
    "target" INTEGER NOT NULL,
    "reward" JSONB NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "status" "UserQuestStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏅',
    "condition" JSONB NOT NULL,
    "reward" JSONB,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🎁',
    "price" INTEGER NOT NULL DEFAULT 0,
    "contentType" "RewardContentType" NOT NULL DEFAULT 'TEXT',
    "contentText" TEXT,
    "contentFileId" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "perUserLimit" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyBonusClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDay" TEXT NOT NULL,
    "dayInCycle" INTEGER NOT NULL,
    "reward" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyBonusClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EasterEgg" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trigger" JSONB NOT NULL,
    "contentType" "RewardContentType" NOT NULL DEFAULT 'TEXT',
    "contentText" TEXT,
    "contentFileId" TEXT,
    "reward" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EasterEgg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEasterEgg" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eggId" TEXT NOT NULL,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "times" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserEasterEgg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEventLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "GameEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");

-- CreateIndex
CREATE INDEX "Word_language_isActive_idx" ON "Word"("language", "isActive");

-- CreateIndex
CREATE INDEX "Word_category_idx" ON "Word"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Word_language_original_translation_key" ON "Word"("language", "original", "translation");

-- CreateIndex
CREATE INDEX "UserWord_userId_nextReviewAt_idx" ON "UserWord"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "UserWord_userId_status_idx" ON "UserWord"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserWord_userId_wordId_key" ON "UserWord"("userId", "wordId");

-- CreateIndex
CREATE INDEX "LearningSession_userId_status_idx" ON "LearningSession"("userId", "status");

-- CreateIndex
CREATE INDEX "LearningSession_userId_localDay_idx" ON "LearningSession"("userId", "localDay");

-- CreateIndex
CREATE INDEX "LearningAnswer_userId_createdAt_idx" ON "LearningAnswer"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAnswer_sessionId_position_key" ON "LearningAnswer"("sessionId", "position");

-- CreateIndex
CREATE INDEX "DailyActivity_userId_localDay_idx" ON "DailyActivity"("userId", "localDay");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_userId_localDay_key" ON "DailyActivity"("userId", "localDay");

-- CreateIndex
CREATE UNIQUE INDEX "EconomyTransaction_idempotencyKey_key" ON "EconomyTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EconomyTransaction_userId_createdAt_idx" ON "EconomyTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EconomyTransaction_reason_idx" ON "EconomyTransaction"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "ShopItem_code_key" ON "ShopItem"("code");

-- CreateIndex
CREATE INDEX "ShopItem_isActive_sortOrder_idx" ON "ShopItem"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_idempotencyKey_key" ON "Purchase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Purchase_userId_createdAt_idx" ON "Purchase"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_userId_code_key" ON "InventoryItem"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_code_key" ON "Quest"("code");

-- CreateIndex
CREATE INDEX "Quest_isActive_period_idx" ON "Quest"("isActive", "period");

-- CreateIndex
CREATE INDEX "UserQuest_userId_status_idx" ON "UserQuest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuest_userId_questId_periodKey_key" ON "UserQuest"("userId", "questId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "Achievement_isActive_sortOrder_idx" ON "Achievement"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_code_key" ON "Reward"("code");

-- CreateIndex
CREATE INDEX "Reward_isActive_idx" ON "Reward"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPurchase_idempotencyKey_key" ON "RewardPurchase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RewardPurchase_userId_createdAt_idx" ON "RewardPurchase"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyBonusClaim_userId_localDay_key" ON "DailyBonusClaim"("userId", "localDay");

-- CreateIndex
CREATE UNIQUE INDEX "EasterEgg_code_key" ON "EasterEgg"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserEasterEgg_userId_eggId_key" ON "UserEasterEgg"("userId", "eggId");

-- CreateIndex
CREATE INDEX "GameEventLog_userId_createdAt_idx" ON "GameEventLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GameEventLog_type_createdAt_idx" ON "GameEventLog"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWord" ADD CONSTRAINT "UserWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWord" ADD CONSTRAINT "UserWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAnswer" ADD CONSTRAINT "LearningAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAnswer" ADD CONSTRAINT "LearningAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAnswer" ADD CONSTRAINT "LearningAnswer_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyTransaction" ADD CONSTRAINT "EconomyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPurchase" ADD CONSTRAINT "RewardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPurchase" ADD CONSTRAINT "RewardPurchase_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBonusClaim" ADD CONSTRAINT "DailyBonusClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEasterEgg" ADD CONSTRAINT "UserEasterEgg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEasterEgg" ADD CONSTRAINT "UserEasterEgg_eggId_fkey" FOREIGN KEY ("eggId") REFERENCES "EasterEgg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEventLog" ADD CONSTRAINT "GameEventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

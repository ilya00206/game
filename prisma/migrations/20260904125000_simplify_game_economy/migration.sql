ALTER TABLE "User" RENAME COLUMN "balance" TO "gems";
ALTER TABLE "LearningSession" RENAME COLUMN "currencyEarned" TO "gemsEarned";

ALTER TABLE "User"
  DROP COLUMN "xp",
  DROP COLUMN "level",
  DROP COLUMN "streakShields",
  DROP COLUMN "streakFrozenDays",
  DROP COLUMN "dailyBonusStreak",
  DROP COLUMN "dailyBonusDay",
  DROP COLUMN "dailyBonusClaimedAt";
ALTER TABLE "Word" DROP COLUMN "note";
ALTER TABLE "LearningSession" DROP COLUMN "xpEarned";
ALTER TABLE "DailyActivity" DROP COLUMN "xpEarned";
ALTER TABLE "NotificationSettings" DROP COLUMN "questReminderEnabled";

DROP TABLE "EconomyTransaction";
DROP TABLE "Purchase";
DROP TABLE "InventoryItem";
DROP TABLE "ShopItem";
DROP TABLE "UserQuest";
DROP TABLE "Quest";
DROP TABLE "UserAchievement";
DROP TABLE "Achievement";
DROP TABLE "RewardPurchase";
DROP TABLE "Reward";
DROP TABLE "DailyBonusClaim";
DROP TABLE "UserEasterEgg";
DROP TABLE "EasterEgg";
DROP TABLE "GameEventLog";

DROP TYPE "TransactionDirection";
DROP TYPE "QuestPeriod";
DROP TYPE "QuestMetric";
DROP TYPE "UserQuestStatus";
DROP TYPE "ShopItemType";
DROP TYPE "RewardContentType";
DROP TYPE "GameEventType";

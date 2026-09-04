ALTER TABLE "LearningSession" ADD COLUMN "groupId" TEXT;
CREATE INDEX "LearningSession_groupId_idx" ON "LearningSession"("groupId");
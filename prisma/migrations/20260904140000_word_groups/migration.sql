CREATE TABLE "WordGroup" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WordGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordGroupAssignment" (
    "wordId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "WordGroupAssignment_pkey" PRIMARY KEY ("wordId", "groupId")
);

CREATE UNIQUE INDEX "WordGroup_language_name_key" ON "WordGroup"("language", "name");
CREATE INDEX "WordGroup_language_idx" ON "WordGroup"("language");
CREATE INDEX "WordGroupAssignment_groupId_idx" ON "WordGroupAssignment"("groupId");

INSERT INTO "WordGroup" ("id", "language", "name", "updatedAt")
SELECT md5("language" || ':' || "category"), "language", "category", CURRENT_TIMESTAMP
FROM "Word"
WHERE "category" IS NOT NULL AND "category" <> ''
GROUP BY "language", "category";

INSERT INTO "WordGroupAssignment" ("wordId", "groupId")
SELECT w."id", md5(w."language" || ':' || w."category")
FROM "Word" w
WHERE w."category" IS NOT NULL AND w."category" <> '';

ALTER TABLE "WordGroupAssignment"
  ADD CONSTRAINT "WordGroupAssignment_wordId_fkey"
  FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordGroupAssignment"
  ADD CONSTRAINT "WordGroupAssignment_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "WordGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Word" DROP COLUMN "category";
ALTER TABLE "Word" DROP COLUMN "difficulty";
DROP TYPE "Difficulty";
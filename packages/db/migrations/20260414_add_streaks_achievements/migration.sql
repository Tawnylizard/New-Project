-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('FIRST_IMPORT', 'WEEK_STREAK', 'MONTH_STREAK', 'FIRST_ROAST', 'GOAL_COMPLETE', 'SUBSCRIPTION_KILLER', 'BUDGET_MASTER', 'SOCIAL_SHARER', 'REFERRAL_ACE');

-- CreateTable
CREATE TABLE "UserStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importStreak" INTEGER NOT NULL DEFAULT 0,
    "importStreakLongest" INTEGER NOT NULL DEFAULT 0,
    "importLastDate" DATE,
    "spendingStreak" INTEGER NOT NULL DEFAULT 0,
    "spendingStreakLongest" INTEGER NOT NULL DEFAULT 0,
    "spendingLastWeek" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievement" "AchievementType" NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStreak_userId_key" ON "UserStreak"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievement_key" ON "UserAchievement"("userId", "achievement");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- AddForeignKey
ALTER TABLE "UserStreak" ADD CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Initial migration — Клёво v0.1.0
-- Creates all enums, tables, indexes, and foreign keys
-- ============================================================

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PLUS');

-- CreateEnum
CREATE TYPE "Category" AS ENUM (
  'FOOD_CAFE',
  'GROCERIES',
  'MARKETPLACE',
  'TRANSPORT',
  'SUBSCRIPTIONS',
  'ENTERTAINMENT',
  'HEALTH',
  'CLOTHING',
  'EDUCATION',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('CSV_SBER', 'CSV_TBANK', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled', 'ignored');

-- CreateEnum
CREATE TYPE "KlyovoSubPlan" AS ENUM ('plus_monthly', 'plus_yearly');

-- CreateEnum
CREATE TYPE "KlyovoSubStatus" AS ENUM ('active', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "BnplStatus" AS ENUM ('active', 'completed', 'overdue', 'dismissed');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM (
  'SAVINGS',
  'EMERGENCY_FUND',
  'VACATION',
  'GADGET',
  'EDUCATION',
  'HOUSING',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM (
  'FIRST_IMPORT',
  'WEEK_STREAK',
  'MONTH_STREAK',
  'FIRST_ROAST',
  'GOAL_COMPLETE',
  'SUBSCRIPTION_KILLER',
  'BUDGET_MASTER',
  'SOCIAL_SHARER',
  'REFERRAL_ACE'
);

-- ============================================================
-- CreateTable: User
-- ============================================================
CREATE TABLE "User" (
    "id"               TEXT        NOT NULL,
    "telegramId"       BIGINT      NOT NULL,
    "telegramUsername" TEXT,
    "displayName"      TEXT        NOT NULL,
    "plan"             "Plan"      NOT NULL DEFAULT 'FREE',
    "planExpiresAt"    TIMESTAMP(3),
    "referralCode"     TEXT        NOT NULL,
    "referredBy"       TEXT,
    "consentGivenAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_telegramId_key"   ON "User"("telegramId");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- ============================================================
-- CreateTable: Transaction
-- ============================================================
CREATE TABLE "Transaction" (
    "id"                 TEXT         NOT NULL,
    "userId"             TEXT         NOT NULL,
    "amountKopecks"      INTEGER      NOT NULL,
    "merchantName"       TEXT         NOT NULL,
    "merchantNormalized" TEXT         NOT NULL,
    "category"           "Category"   NOT NULL,
    "transactionDate"    TIMESTAMP(3) NOT NULL,
    "source"             "Source"     NOT NULL,
    "rawDescription"     TEXT,
    "isBnpl"             BOOLEAN      NOT NULL DEFAULT false,
    "bnplService"        TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Transaction_userId_transactionDate_amountKopecks_merchantNormalized_key"
    ON "Transaction"("userId", "transactionDate", "amountKopecks", "merchantNormalized");
CREATE INDEX "Transaction_userId_transactionDate_idx"
    ON "Transaction"("userId", "transactionDate");

-- ============================================================
-- CreateTable: RoastSession
-- ============================================================
CREATE TABLE "RoastSession" (
    "id"              TEXT         NOT NULL,
    "userId"          TEXT         NOT NULL,
    "roastText"       TEXT         NOT NULL,
    "spendingSummary" JSONB        NOT NULL,
    "mode"            TEXT         NOT NULL,
    "sharedAt"        TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoastSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoastSession_userId_createdAt_idx" ON "RoastSession"("userId", "createdAt");

-- ============================================================
-- CreateTable: DetectedSubscription
-- ============================================================
CREATE TABLE "DetectedSubscription" (
    "id"              TEXT                 NOT NULL,
    "userId"          TEXT                 NOT NULL,
    "merchantName"    TEXT                 NOT NULL,
    "estimatedAmount" INTEGER              NOT NULL,
    "frequencyDays"   INTEGER              NOT NULL,
    "lastChargeDate"  TIMESTAMP(3)         NOT NULL,
    "occurrences"     INTEGER              NOT NULL DEFAULT 1,
    "status"          "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "createdAt"       TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectedSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DetectedSubscription_userId_merchantName_key"
    ON "DetectedSubscription"("userId", "merchantName");
CREATE INDEX "DetectedSubscription_userId_status_idx"
    ON "DetectedSubscription"("userId", "status");

-- ============================================================
-- CreateTable: KlyovoSubscription
-- ============================================================
CREATE TABLE "KlyovoSubscription" (
    "id"                TEXT              NOT NULL,
    "userId"            TEXT              NOT NULL,
    "plan"              "KlyovoSubPlan"   NOT NULL,
    "status"            "KlyovoSubStatus" NOT NULL DEFAULT 'active',
    "yookassaPaymentId" TEXT              NOT NULL,
    "startedAt"         TIMESTAMP(3)      NOT NULL,
    "expiresAt"         TIMESTAMP(3)      NOT NULL,
    "createdAt"         TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KlyovoSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KlyovoSubscription_yookassaPaymentId_key"
    ON "KlyovoSubscription"("yookassaPaymentId");
CREATE INDEX "KlyovoSubscription_userId_status_idx"
    ON "KlyovoSubscription"("userId", "status");

-- ============================================================
-- CreateTable: BnplObligation
-- ============================================================
CREATE TABLE "BnplObligation" (
    "id"                  TEXT         NOT NULL,
    "userId"              TEXT         NOT NULL,
    "bnplService"         TEXT         NOT NULL,
    "merchantName"        TEXT         NOT NULL,
    "merchantDisplay"     TEXT         NOT NULL,
    "installmentAmount"   INTEGER      NOT NULL,
    "totalInstallments"   INTEGER      NOT NULL,
    "paidInstallments"    INTEGER      NOT NULL,
    "firstPaymentDate"    TIMESTAMP(3) NOT NULL,
    "lastPaymentDate"     TIMESTAMP(3) NOT NULL,
    "nextPaymentDate"     TIMESTAMP(3),
    "frequencyDays"       INTEGER      NOT NULL,
    "status"              "BnplStatus" NOT NULL DEFAULT 'active',
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BnplObligation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BnplObligation_userId_bnplService_merchantName_firstPaymentDate_key"
    ON "BnplObligation"("userId", "bnplService", "merchantName", "firstPaymentDate");
CREATE INDEX "BnplObligation_userId_status_idx" ON "BnplObligation"("userId", "status");

-- ============================================================
-- CreateTable: FinancialGoal
-- ============================================================
CREATE TABLE "FinancialGoal" (
    "id"                   TEXT           NOT NULL,
    "userId"               TEXT           NOT NULL,
    "name"                 TEXT           NOT NULL,
    "category"             "GoalCategory" NOT NULL,
    "targetAmountKopecks"  INTEGER        NOT NULL,
    "currentAmountKopecks" INTEGER        NOT NULL DEFAULT 0,
    "deadline"             TIMESTAMP(3),
    "status"               "GoalStatus"   NOT NULL DEFAULT 'ACTIVE',
    "aiAdvice"             TEXT,
    "aiAdviceGeneratedAt"  TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialGoal_userId_status_idx" ON "FinancialGoal"("userId", "status");

-- ============================================================
-- CreateTable: UserStreak
-- ============================================================
CREATE TABLE "UserStreak" (
    "id"                   TEXT         NOT NULL,
    "userId"               TEXT         NOT NULL,
    "importStreak"         INTEGER      NOT NULL DEFAULT 0,
    "importStreakLongest"  INTEGER      NOT NULL DEFAULT 0,
    "importLastDate"       DATE,
    "spendingStreak"       INTEGER      NOT NULL DEFAULT 0,
    "spendingStreakLongest" INTEGER     NOT NULL DEFAULT 0,
    "spendingLastWeek"     TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserStreak_userId_key" ON "UserStreak"("userId");

-- ============================================================
-- CreateTable: UserAchievement
-- ============================================================
CREATE TABLE "UserAchievement" (
    "id"          TEXT              NOT NULL,
    "userId"      TEXT              NOT NULL,
    "achievement" "AchievementType" NOT NULL,
    "unlockedAt"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAchievement_userId_achievement_key"
    ON "UserAchievement"("userId", "achievement");
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- ============================================================
-- Foreign Keys (all with CASCADE DELETE)
-- ============================================================
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoastSession"
    ADD CONSTRAINT "RoastSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DetectedSubscription"
    ADD CONSTRAINT "DetectedSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KlyovoSubscription"
    ADD CONSTRAINT "KlyovoSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BnplObligation"
    ADD CONSTRAINT "BnplObligation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialGoal"
    ADD CONSTRAINT "FinancialGoal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserStreak"
    ADD CONSTRAINT "UserStreak_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAchievement"
    ADD CONSTRAINT "UserAchievement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

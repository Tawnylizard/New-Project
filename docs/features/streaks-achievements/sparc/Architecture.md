# Architecture — Стрики и ачивки

> SPARC Phase 5 · ARCHITECTURE  
> Дата: 2026-04-14

---

## Architecture Overview

Следует существующей архитектуре Клёво: Distributed Monolith (Monorepo). Новые компоненты интегрируются в `apps/api` и `apps/tma`.

```mermaid
graph TB
  subgraph TMA["apps/tma (React 18)"]
    A[AchievementsPage]
    B[StreakWidget]
    C[AchievementCard]
    D[ShareButton]
  end
  subgraph API["apps/api (Fastify 5)"]
    E[GET /streaks]
    F[GET /achievements]
    G[StreakService]
    H[AchievementService]
    I[SpendingStreakCron]
  end
  subgraph DB["packages/db (Prisma + PostgreSQL)"]
    J[(UserStreak)]
    K[(UserAchievement)]
  end
  subgraph Cache["Yandex Redis"]
    L[streak:{userId}]
  end

  A --> F
  B --> E
  D --> |Telegram.WebApp.shareMessage| TG[Telegram]

  E --> G
  F --> H
  G --> L
  G --> J
  H --> K
  I --> G
  I --> H
```

---

## New Components

### Backend

#### `StreakService` (`apps/api/src/services/StreakService.ts`)
- `getStreaks(userId)` — read from Redis → DB fallback
- `updateImportStreak(userId)` — on-write streak update
- `invalidateCache(userId)` — Redis invalidation

#### `AchievementService` (`apps/api/src/services/AchievementService.ts`)
- `checkAndUnlock(userId, triggerEvent)` — idempotent achievement check
- `getAchievements(userId)` — all achievements (unlocked + locked)
- `ACHIEVEMENT_CATALOGUE` — static map of all 9 achievements with metadata

#### `SpendingStreakCron` (`apps/api/src/jobs/spendingStreakCron.ts`)
- Runs every Sunday at 23:59 UTC+3
- Computes weekly spending comparison for all active users
- Calls `StreakService.updateSpendingStreak()` and `AchievementService.checkAndUnlock()`

#### Routes (`apps/api/src/routes/streaks.ts`)
- `GET /streaks` — returns StreakService.getStreaks(userId)
- `GET /achievements` — returns AchievementService.getAchievements(userId)

### Frontend

#### `AchievementsPage` (`apps/tma/src/pages/Achievements.tsx`)
- Grid of all 9 achievements (unlocked highlighted, locked greyed)
- Each card: emoji, name, description, unlock date or lock icon

#### `StreakWidget` (`apps/tma/src/components/StreakWidget.tsx`)
- Compact widget for home screen: 🔥 7 дней
- Shows import streak + spending streak

#### `AchievementCard` (`apps/tma/src/components/AchievementCard.tsx`)
- Individual achievement: emoji, name, status, share button

---

## Integration Points

### Existing routes that trigger achievements

| Route | Trigger Event | Achievement(s) |
|-------|---------------|----------------|
| `POST /transactions/import` | `IMPORT_COMPLETED` | `FIRST_IMPORT`, `WEEK_STREAK`, `MONTH_STREAK` |
| `POST /roast/generate` | `ROAST_GENERATED` | `FIRST_ROAST` |
| `PATCH /goals/:id` (→ COMPLETED) | `GOAL_STATUS_COMPLETED` | `GOAL_COMPLETE` |
| `PATCH /subscriptions/:id` (→ cancelled) | `SUBSCRIPTION_CANCELLED` | `SUBSCRIPTION_KILLER` |
| Weekly cron (spendingStreak >= 4) | `BUDGET_MASTER_TRIGGER` | `BUDGET_MASTER` |
| `POST /streaks/share` | `SHARE_ACTION` | `SOCIAL_SHARER` |
| Referral: 3rd conversion | `REFERRAL_CONVERTED_3` | `REFERRAL_ACE` |

Each trigger is a non-blocking `await` — failure doesn't affect the main action.

---

## Database Schema (additions to schema.prisma)

```prisma
model UserStreak {
  id                    String    @id @default(uuid())
  userId                String    @unique
  importStreak          Int       @default(0)
  importStreakLongest   Int       @default(0)
  importLastDate        DateTime? @db.Date
  spendingStreak        Int       @default(0)
  spendingStreakLongest Int       @default(0)
  spendingLastWeek      String?   // ISO week: "2026-W15"
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum AchievementType {
  FIRST_IMPORT
  WEEK_STREAK
  MONTH_STREAK
  FIRST_ROAST
  GOAL_COMPLETE
  SUBSCRIPTION_KILLER
  BUDGET_MASTER
  SOCIAL_SHARER
  REFERRAL_ACE
}

model UserAchievement {
  id          String          @id @default(uuid())
  userId      String
  achievement AchievementType
  unlockedAt  DateTime        @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, achievement])
  @@index([userId])
}
```

User model additions:
```prisma
userStreak      UserStreak?
achievements    UserAchievement[]
```

---

## Redis Cache Strategy

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `streak:{userId}` | JSON StreakData | 3600s (1h) |

Invalidated on:
- Any import action (StreakService.updateImportStreak)
- Weekly cron completion

---

## Security Architecture

- All routes protected by `requireAuth` JWT plugin (existing)
- No user PD in achievement share text
- Streak computed server-side — no client-side manipulation possible
- Achievement unlock is idempotent DB upsert — no race condition issues

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Backend | Fastify 5 + TypeScript | Existing stack |
| Cron | `node-cron` | Lightweight, already available |
| DB | Prisma + PostgreSQL | Existing ORM |
| Cache | Yandex Redis | Existing cache layer |
| Frontend | React 18 + TailwindCSS | Existing TMA stack |
| Share | Telegram.WebApp.shareMessage | Native Telegram API |

---

## Consistency with docs/Architecture.md

- Single Fastify app with plugin registration ✅
- Prisma as sole DB access layer ✅
- Redis for hot data caching ✅
- JWT auth on all routes ✅
- Services contain business logic, routes are thin ✅
- Money in kopecks: streak amounts don't involve money — N/A ✅

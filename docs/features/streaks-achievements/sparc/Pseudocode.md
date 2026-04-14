# Pseudocode — Стрики и ачивки

> SPARC Phase 4 · PSEUDOCODE  
> Дата: 2026-04-14

---

## Data Structures

### StreakType (enum)
```
IMPORT   — consecutive days with import or goal update activity
SPENDING — consecutive weeks with spending < previous week
```

### AchievementType (enum)
```
FIRST_IMPORT
WEEK_STREAK
MONTH_STREAK
FIRST_ROAST
GOAL_COMPLETE
SUBSCRIPTION_KILLER
BUDGET_MASTER
SOCIAL_SHARER
REFERRAL_ACE
```

### UserStreak (DB model)
```
type UserStreak = {
  id:                  UUID
  userId:              String  (unique per user)
  importStreak:        Int     (current consecutive days)
  importStreakLongest: Int
  importLastDate:      Date?   (date-only, no time)
  spendingStreak:      Int     (current consecutive weeks)
  spendingStreakLongest: Int
  spendingLastWeek:    String? (ISO week string e.g. "2026-W15")
  createdAt:           DateTime
  updatedAt:           DateTime
}
```

### UserAchievement (DB model)
```
type UserAchievement = {
  id:          UUID
  userId:      String
  achievement: AchievementType
  unlockedAt:  DateTime
}
@@unique([userId, achievement])
```

---

## Core Algorithms

### Algorithm: UpdateImportStreak
TRIGGER: After successful CSV import OR manual goal progress update
INPUT: userId: String, actionDate: Date (today)
OUTPUT: { newStreak: Int, wasReset: Boolean }

```
FUNCTION updateImportStreak(userId, actionDate):
  streak = GET UserStreak WHERE userId = userId
           OR CREATE new UserStreak for userId with all zeros
  
  IF streak.importLastDate IS NULL:
    // First ever activity
    streak.importStreak = 1
    streak.importLastDate = actionDate
    streak.importStreakLongest = 1
    SAVE streak
    RETURN { newStreak: 1, wasReset: false }
  
  daysDiff = dateDifferenceInDays(actionDate, streak.importLastDate)
  
  IF daysDiff == 0:
    // Same day — already counted
    RETURN { newStreak: streak.importStreak, wasReset: false }
  
  IF daysDiff == 1:
    // Consecutive day — extend streak
    streak.importStreak += 1
    streak.importLastDate = actionDate
    IF streak.importStreak > streak.importStreakLongest:
      streak.importStreakLongest = streak.importStreak
    SAVE streak
    RETURN { newStreak: streak.importStreak, wasReset: false }
  
  IF daysDiff == 2:
    // Grace period — 1 day missed, don't reset
    streak.importStreak += 1
    streak.importLastDate = actionDate
    IF streak.importStreak > streak.importStreakLongest:
      streak.importStreakLongest = streak.importStreak
    SAVE streak
    RETURN { newStreak: streak.importStreak, wasReset: false }
  
  // daysDiff >= 3 — streak broken
  streak.importStreak = 1
  streak.importLastDate = actionDate
  SAVE streak
  RETURN { newStreak: 1, wasReset: true }
```

### Algorithm: ComputeSpendingStreak (cron, weekly)
TRIGGER: Every Sunday at 23:59 UTC+3 (cron job)
INPUT: all users with transactions
OUTPUT: updated spendingStreak for all active users

```
FUNCTION computeSpendingStreakForAllUsers():
  currentWeek = getCurrentISOWeek()  // e.g. "2026-W15"
  previousWeek = getPreviousISOWeek()
  
  activeUsers = GET all userIds with transactions in currentWeek OR previousWeek
  
  FOR EACH userId IN activeUsers:
    currentWeekTotal = SUM(amountKopecks) WHERE userId = userId
                       AND transactionDate IN currentWeek
                       AND amountKopecks > 0  // exclude income
    
    previousWeekTotal = SUM(amountKopecks) WHERE userId = userId
                        AND transactionDate IN previousWeek
                        AND amountKopecks > 0
    
    streak = GET UserStreak WHERE userId = userId
    
    IF currentWeekTotal == 0 AND previousWeekTotal == 0:
      // No data → freeze (no change)
      CONTINUE
    
    IF currentWeekTotal == 0:
      // No transactions this week → freeze
      CONTINUE
    
    IF previousWeekTotal == 0:
      // No previous data to compare → freeze
      CONTINUE
    
    IF streak.spendingLastWeek == currentWeek:
      // Already computed this week
      CONTINUE
    
    IF currentWeekTotal < previousWeekTotal:
      // Spent less → extend streak
      streak.spendingStreak += 1
      IF streak.spendingStreak > streak.spendingStreakLongest:
        streak.spendingStreakLongest = streak.spendingStreak
    ELSE:
      // Spent same or more → reset
      streak.spendingStreak = 0
    
    streak.spendingLastWeek = currentWeek
    SAVE streak
    
    // Check BUDGET_MASTER achievement (4 weeks streak)
    IF streak.spendingStreak >= 4:
      checkAndUnlock(userId, 'BUDGET_MASTER_TRIGGER')
```

### Algorithm: CheckAndUnlock Achievement
INPUT: userId: String, triggerEvent: TriggerEvent
OUTPUT: newlyUnlocked: AchievementType[]

```
FUNCTION checkAndUnlock(userId, triggerEvent):
  newlyUnlocked = []
  
  achievementsToCheck = ACHIEVEMENT_TRIGGER_MAP[triggerEvent]
  // e.g. 'IMPORT_COMPLETED' → [FIRST_IMPORT]
  //      'IMPORT_STREAK_7'  → [WEEK_STREAK]
  //      'IMPORT_STREAK_30' → [MONTH_STREAK]
  //      'ROAST_GENERATED'  → [FIRST_ROAST]
  //      'GOAL_COMPLETED'   → [GOAL_COMPLETE]
  //      'SUBSCRIPTION_CANCELLED' → [SUBSCRIPTION_KILLER]
  //      'BUDGET_MASTER_TRIGGER'  → [BUDGET_MASTER]
  //      'ACHIEVEMENT_SHARED'     → [SOCIAL_SHARER]
  //      'REFERRAL_THRESHOLD'     → [REFERRAL_ACE]
  
  FOR EACH achievementType IN achievementsToCheck:
    TRY:
      INSERT INTO UserAchievement (userId, achievement, unlockedAt)
      VALUES (userId, achievementType, NOW())
      ON CONFLICT (userId, achievement) DO NOTHING
      RETURNING *
    
    IF inserted:
      newlyUnlocked.push(achievementType)
  
  RETURN newlyUnlocked
  // Caller emits these to response so TMA can show toast
```

### Algorithm: GetStreaks (cached)
INPUT: userId: String
OUTPUT: StreakData

```
FUNCTION getStreaks(userId):
  cacheKey = "streak:" + userId
  cached = REDIS.GET(cacheKey)
  
  IF cached:
    RETURN JSON.parse(cached)
  
  streak = GET UserStreak WHERE userId = userId
  
  IF NOT streak:
    RETURN { importStreak: { current: 0, longest: 0 },
             spendingStreak: { current: 0, longest: 0 } }
  
  result = {
    importStreak: {
      current: streak.importStreak,
      longest: streak.importStreakLongest,
      lastActiveDate: streak.importLastDate
    },
    spendingStreak: {
      current: streak.spendingStreak,
      longest: streak.spendingStreakLongest,
      lastComputedWeek: streak.spendingLastWeek
    }
  }
  
  REDIS.SET(cacheKey, JSON.stringify(result), EX: 3600)
  RETURN result
```

---

## API Contracts

### GET /streaks
```
Request:
  Headers: { Authorization: Bearer <jwt> }

Response 200:
  {
    importStreak: { current: Int, longest: Int, lastActiveDate: String? }
    spendingStreak: { current: Int, longest: Int, lastComputedWeek: String? }
  }
```

### GET /achievements
```
Request:
  Headers: { Authorization: Bearer <jwt> }

Response 200:
  {
    unlocked: Array<{ type, unlockedAt, emoji, name, description }>
    locked:   Array<{ type, emoji, name, description }>
  }
```

---

## Achievement Trigger Map

```
IMPORT_COMPLETED        → check: FIRST_IMPORT
                          check: WEEK_STREAK (if importStreak >= 7)
                          check: MONTH_STREAK (if importStreak >= 30)
ROAST_GENERATED         → check: FIRST_ROAST
GOAL_STATUS_COMPLETED   → check: GOAL_COMPLETE
SUBSCRIPTION_CANCELLED  → check: SUBSCRIPTION_KILLER
BUDGET_MASTER_TRIGGER   → check: BUDGET_MASTER (spendingStreak >= 4)
SHARE_ACTION            → check: SOCIAL_SHARER
REFERRAL_CONVERTED_3    → check: REFERRAL_ACE
```

---

## State Transitions: Import Streak

```
[No Streak] --first import--> [Streak: 1]
[Streak: N] --same day--> [Streak: N]  (no change)
[Streak: N] --next day (diff=1)--> [Streak: N+1]
[Streak: N] --grace day (diff=2)--> [Streak: N+1]
[Streak: N] --broken (diff>=3)--> [Streak: 1]
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Streak DB write fails | Log error, return cached/last known value, non-blocking |
| Achievement insert fails (not unique constraint) | Ignore — constraint handles idempotency |
| Redis unavailable | Fall through to DB, log warn |
| spendingStreak compute: no prior week | Freeze (no change) |
| Invalid userId | 401 Unauthorized (JWT check upstream) |

# Refinement — Стрики и ачивки

> SPARC Phase 6 · REFINEMENT  
> Дата: 2026-04-14

---

## Edge Cases Matrix

| Scenario | Input | Expected | Handling |
|----------|-------|----------|----------|
| First ever import | importLastDate = null | streak = 1 | Null-check before diff calc |
| Double import same day | importLastDate = today | streak unchanged | daysDiff == 0 → skip |
| Grace period used | importLastDate = 2 days ago | streak +1, not reset | daysDiff == 2 → extend |
| Streak broken | importLastDate = 3+ days ago | streak = 1 | daysDiff >= 3 → reset |
| No previous week spending | previousWeekTotal = 0 | freeze spending streak | Skip computation, no change |
| No current week spending | currentWeekTotal = 0 | freeze spending streak | Skip computation, no change |
| Achievement already unlocked | userId + type @@unique | no duplicate | DB constraint + DO NOTHING |
| Redis unavailable | GET returns null | fall through to DB | try/catch → DB fallback |
| Cron runs twice same week | spendingLastWeek = currentWeek | skip | Check before computing |
| User deletes account | Cascade delete | All streaks/achievements deleted | @@onDelete: Cascade |
| Timezone edge case | User in UTC+3, action at 23:50 | Use server UTC+3 date | Store date in UTC+3 |
| Very long streak (999+ days) | importStreak = 999 | Works normally | No upper bound needed |
| REFERRAL_ACE: exactly 3 referrals | referral count = 3 | unlock REFERRAL_ACE | Check in referral route post-conversion |

---

## Testing Strategy

### Unit Tests (StreakService)
- `updateImportStreak`: same-day, next-day, grace-day, broken cases
- `computeSpendingStreak`: less/same/more/no-data scenarios
- `getStreaks`: Redis hit, Redis miss → DB fallback, no streak at all

### Unit Tests (AchievementService)
- `checkAndUnlock`: each trigger event → correct achievements
- Idempotency: calling unlock twice → only 1 row in DB
- `getAchievements`: correct split of unlocked/locked

### Integration Tests (Fastify inject)
- `GET /streaks`: returns streak data, auth required
- `GET /achievements`: returns correct split, auth required
- Import route → FIRST_IMPORT unlocked in response
- Roast route → FIRST_ROAST unlocked in response
- Goal COMPLETED → GOAL_COMPLETE unlocked

### Coverage Targets
- `StreakService`: 100% lines (critical algorithm)
- `AchievementService`: 100% lines (critical algorithm)
- Routes: ≥60% lines

---

## Test Cases (Gherkin)

```gherkin
Feature: Import Streak

Scenario: First import starts streak
  Given I have never imported before
  When I complete a CSV import
  Then my import streak is 1
  And FIRST_IMPORT achievement is unlocked

Scenario: Consecutive day extends streak
  Given my import streak is 5
  And my last import was yesterday
  When I complete a CSV import
  Then my import streak is 6

Scenario: Grace period prevents reset
  Given my import streak is 5
  And my last import was 2 days ago
  When I complete a CSV import
  Then my import streak is 6
  And wasReset is false

Scenario: Missing 3 days resets streak
  Given my import streak is 10
  And my last import was 5 days ago
  When I complete a CSV import
  Then my import streak is 1
  And wasReset is true

Feature: Achievements

Scenario: FIRST_IMPORT is idempotent
  Given FIRST_IMPORT is already unlocked
  When I import CSV again
  Then no duplicate FIRST_IMPORT achievement is created

Scenario: WEEK_STREAK unlocked at 7 days
  Given my import streak reaches 7
  When the achievement check runs
  Then WEEK_STREAK is unlocked

Scenario: MONTH_STREAK unlocked at 30 days
  Given my import streak reaches 30
  When the achievement check runs
  Then MONTH_STREAK is unlocked

Feature: Spending Streak

Scenario: Less spending this week extends streak
  Given I spent ₽10,000 last week
  And I spent ₽8,000 this week
  When the Sunday cron runs
  Then my spending streak increments by 1

Scenario: No data this week freezes streak
  Given I have no transactions this week
  When the Sunday cron runs
  Then my spending streak is unchanged

Scenario: More spending resets streak
  Given I spent ₽8,000 last week
  And I spent ₽12,000 this week
  When the Sunday cron runs
  Then my spending streak is 0
```

---

## Performance Optimizations

- **Redis cache** for GET /streaks (hot path on app open)
- **Single DB row** per user for streaks (no history table needed for v1)
- **Batch cron** for spending streak — one query per user instead of N+1
- `@@index([userId])` on UserAchievement for fast lookup

---

## Security Hardening

- Zod schema on all routes (no body for GET, JWT required)
- Share text sanitized: only achievement emoji + name (no amounts, no PD)
- Cron job not exposed via HTTP — internal only

---

## Technical Debt Items

- Spending streak cron uses `node-cron` — for production with serverless, move to Yandex Cloud Scheduler (Phase 2)
- No streak freeze for users on vacation (Phase 2 consideration)
- No push notification when streak is about to break (Phase 2)
- History of streak over time (PLUS feature, Phase 2)

# Specification — Стрики и ачивки

> SPARC Phase 3 · SPECIFICATION  
> Дата: 2026-04-14

---

## User Stories

### US-001: Просмотр стрика
```
As a Клёво user,
I want to see my current streak count on the home screen,
So that I know how many consecutive days I've been active.

Acceptance Criteria:
Given I am authenticated
When I open the app
Then I see my current import streak (number + flame icon)

Given my streak is 0
When I open the app
Then I see "Начни стрик сегодня!"

Given I haven't imported in 2+ days
When I open the app
Then streak is reset to 0 and I see reset notification
```

### US-002: Автоматическое обновление стрика при импорте
```
As a Клёво user,
I want my streak to automatically update when I import a CSV,
So that I don't need to do anything extra.

Acceptance Criteria:
Given my last import was yesterday (or today)
When I complete a CSV import
Then streak increments by 1

Given my last import was more than 1 day ago (grace period expired)
When I complete a CSV import
Then streak resets to 1

Given my last import was today
When I import again
Then streak stays the same (not double-counted)
```

### US-003: Просмотр ачивок
```
As a Клёво user,
I want to see all available achievements and which ones I've unlocked,
So that I know what milestones to work towards.

Acceptance Criteria:
Given I am authenticated
When I open the Achievements screen
Then I see all 9 achievements (locked ones are greyed out)

Given I have unlocked FIRST_IMPORT
When I view achievements
Then FIRST_IMPORT shows unlock date and is highlighted
```

### US-004: Автоматическая разблокировка ачивки
```
As a Клёво user,
I want to be notified when I unlock a new achievement,
So that I feel rewarded for my actions.

Acceptance Criteria:
Given I complete my first CSV import
When the import succeeds
Then FIRST_IMPORT achievement is unlocked
And I see an achievement unlock toast notification

Given FIRST_IMPORT is already unlocked
When I import again
Then no duplicate unlock notification (idempotent)
```

### US-005: Шеринг ачивки в Telegram
```
As a Клёво user,
I want to share my achievement in Telegram,
So that my friends see I'm managing my finances.

Acceptance Criteria:
Given I have unlocked at least one achievement
When I tap "Поделиться" on an achievement
Then Telegram share dialog opens with pre-filled text
And the share text contains the achievement emoji + name
And the share text does NOT contain any financial amounts (privacy)
```

### US-006: Spending Streak (просмотр)
```
As a Клёво user with transaction history,
I want to see my spending streak (consecutive weeks under budget),
So that I know if I'm trending better.

Acceptance Criteria:
Given I spent less this week than last week
When the weekly spending streak is computed
Then spending streak increments by 1

Given I have no transactions this week
When the weekly spending streak is computed
Then streak is frozen (not incremented, not reset)

Given I spent more this week than last week
When the weekly spending streak is computed
Then spending streak resets to 0
```

---

## Non-Functional Requirements

### Performance
- GET /streaks: p99 < 100ms (Redis cache hit)
- GET /achievements: p99 < 200ms
- Achievement unlock check: < 50ms overhead on triggering action

### Security
- All endpoints require valid JWT
- No PD in shareable achievement text
- Spending streak computed server-side only (no client-side manipulation)

### Scalability
- Streak stored per-user in Redis (hot) + PostgreSQL (persistent)
- Achievement checks are O(1) — single DB upsert attempt

### Reliability
- Achievement unlock is idempotent (@@unique constraint)
- Streak computation is deterministic from transaction data

---

## Feature Matrix

| Feature | FREE | PLUS |
|---------|------|------|
| Import Streak (current) | ✅ | ✅ |
| Spending Streak (current) | ✅ | ✅ |
| Streak history (chart) | ❌ | ✅ |
| Longest streak badge | ✅ | ✅ |
| All 9 achievements | ✅ | ✅ |
| Share achievement | ✅ | ✅ |

---

## API Contracts

### GET /streaks
Response 200:
```json
{
  "importStreak": {
    "current": 7,
    "longest": 14,
    "lastActiveDate": "2026-04-14"
  },
  "spendingStreak": {
    "current": 3,
    "longest": 8,
    "lastComputedWeek": "2026-W15"
  }
}
```

### GET /achievements
Response 200:
```json
{
  "unlocked": [
    {
      "type": "FIRST_IMPORT",
      "unlockedAt": "2026-04-01T12:00:00Z",
      "emoji": "📂",
      "name": "Первый шаг",
      "description": "Первый CSV-импорт"
    }
  ],
  "locked": [
    {
      "type": "WEEK_STREAK",
      "emoji": "🔥",
      "name": "Неделя не сломался",
      "description": "Стрик 7 дней"
    }
  ]
}
```

### POST /streaks/share
Trigger: user taps "Поделиться" on an achievement. Records SOCIAL_SHARER event.

Request body:
```json
{ "achievementType": "FIRST_IMPORT" }
```

Response 200:
```json
{
  "shareText": "📂 Первый шаг — я начал следить за финансами в Клёво! 🔥",
  "newlyUnlocked": ["SOCIAL_SHARER"]
}
```

Response 400: `{ "error": { "code": "ACHIEVEMENT_NOT_UNLOCKED", "message": "Ачивка не разблокирована" } }`

### Performance (NFR → AC reference)
- `GET /streaks`: p99 < 100ms (Redis cache hit); p99 < 300ms (DB fallback)
- `GET /achievements`: p99 < 200ms
- `POST /streaks/share`: p99 < 150ms

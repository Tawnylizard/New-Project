# Refinement — Финансовые цели

> SPARC Phase 6 · REFINEMENT  
> Дата: 2026-04-14

---

## Edge Cases Matrix

| Сценарий | Input | Expected | Handling |
|----------|-------|----------|---------|
| FREE user создаёт 2-ю цель | POST /goals, activeCount=1, plan=FREE | 403 GOAL_LIMIT_REACHED | Plan check before DB write |
| target = current при создании | targetAmount=1000, currentAmount=1000 | status=COMPLETED сразу | Algorithm: CreateGoal step 4 |
| deadline в прошлом | deadline=2020-01-01 | 400 INVALID_DEADLINE | Zod + service validation |
| currentAmount > target при обновлении | currentAmount=999999, target=100 | status=COMPLETED, amount capped at target? | Нет — сохраняем как есть, статус COMPLETED |
| AI запрос для ABANDONED цели | POST /goals/:id/advice, status=ABANDONED | 404 GOAL_NOT_FOUND | findFirst WHERE status=ACTIVE |
| YandexGPT + GigaChat timeout | Оба таймаут 5с | Cached fallback advice | try/catch chain в GoalService |
| Нет транзакций в последние 30 дней | spendingSummary.totalKopecks=0 | AI отвечает без конкретных сумм | Fallback to generic advice by category |
| Пользователь удаляет юзера | CASCADE DELETE | Все цели удаляются | Prisma onDelete: Cascade |
| Одновременное обновление прогресса | Race condition | Последняя запись побеждает | Prisma atomic update (single row) |
| PLUS → FREE downgrade | plan=FREE, activeGoals=5 | Существующие цели сохраняются, новые заблокированы | Только CREATE проверяет plan |

---

## Testing Strategy

### Unit Tests (`GoalService.test.ts`)
- Coverage target: ≥80% lines, ≥70% branches
- Mock: Prisma client, Redis client, YandexGPT, GigaChat

### Integration Tests (`goals.test.ts`)
- Fastify inject (no real HTTP)
- Real Prisma against test PostgreSQL
- Real Redis (test instance)

### Critical Test Paths
1. FREE limit enforcement
2. PLUS plan check for AI advice
3. LLM fallback chain
4. Progress → COMPLETED auto-transition
5. Goal ownership (userId scoping)

---

## Test Cases

```gherkin
Feature: Financial Goals

  Scenario: FREE user creates first goal
    Given I am a FREE user with 0 active goals
    When I POST /goals with valid data
    Then I receive 201 with the created goal

  Scenario: FREE user hits limit
    Given I am a FREE user with 1 active goal
    When I POST /goals
    Then I receive 403 with code GOAL_LIMIT_REACHED

  Scenario: Goal auto-completes
    Given I have an active goal with target 100000 kopecks
    When I PUT /goals/:id with currentAmountKopecks: 100000
    Then goal.status is COMPLETED

  Scenario: PLUS user gets AI advice
    Given I am a PLUS user with an active goal and transactions
    When I POST /goals/:id/advice
    Then I receive 200 with a non-empty advice string containing disclaimer

  Scenario: FREE user blocked from AI advice
    Given I am a FREE user with an active goal
    When I POST /goals/:id/advice
    Then I receive 403 with code PLAN_REQUIRED

  Scenario: AI advice uses fallback when LLM unavailable
    Given YandexGPT and GigaChat both timeout
    When I POST /goals/:id/advice
    Then I receive 200 with cached fallback advice (not 503)

  Scenario: Cannot update ABANDONED goal
    Given I have a goal with status ABANDONED
    When I PUT /goals/:id with currentAmountKopecks
    Then I receive 400 with code GOAL_ARCHIVED

  Scenario: Goal not found for another user
    Given goal belongs to user A
    When user B calls PUT /goals/:goalId
    Then user B receives 404
```

---

## Performance Optimizations

| Оптимизация | Описание |
|------------|---------|
| AI advice cache | Redis TTL 2ч per goalId+spendingHash — повторные запросы мгновенны |
| DB index | `@@index([userId, status])` — fast lookup for user's active goals |
| DB aiAdvice field | Последний совет сохраняется в БД — показываем без LLM-запроса при открытии |
| Spending aggregation | SQL GROUP BY category в одном запросе, не N+1 |

---

## Security Hardening

- Все /goals/* требуют JWT (authPlugin.preHandler)
- `userId` берётся из JWT, НЕ из request body/params
- Zod: `name` — 1-100 chars; `targetAmountKopecks` — positive integer; `deadline` — future ISO date
- LLM input: только агрегированные данные (суммы по категориям), никаких имён мерчантов
- Rate limit: 10 advice requests / 1 hour per user (Redis key: `rate:advice:{userId}`)

---

## Technical Debt Items

| Пункт | Приоритет | Когда |
|-------|---------|-------|
| Auto-calculate progress from transactions (если мерчант = "накопления") | LOW | v2.0 |
| Bot push-notification at 50%/100% goal progress | MEDIUM | v1.1 |
| Goal sharing card (как RoastCard) | LOW | v2.0 |
| Reactivate ABANDONED goal | LOW | v2.0 |

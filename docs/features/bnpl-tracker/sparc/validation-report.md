# Requirements Validation Report: BNPL-трекер

## Summary

- Stories analyzed: 4
- Average score: **85/100**
- Blocked: **0**
- Status: **PASSED — ready for implementation**

## Results

| Story | Title | Score | INVEST | SMART | Security | Status |
|-------|-------|-------|--------|-------|----------|--------|
| US-1 | Сканирование BNPL | 84/100 | 6/6 ✓ | 4/5 | ✓ | READY |
| US-2 | Просмотр обязательств | 88/100 | 6/6 ✓ | 5/5 ✓ | ✓ | READY |
| US-3 | Timeline платежей | 80/100 | 6/6 ✓ | 4/5 | — | READY |
| US-4 | Управление обязательством | 87/100 | 6/6 ✓ | 5/5 ✓ | ✓ | READY |

## Detailed Analysis

### US-1: Сканирование BNPL (84/100)

**INVEST:** 6/6 — независима, ценна, тестируема, мала для спринта.

**SMART (4/5):**
- ✓ Specific: чёткий trigger (нажатие кнопки → scan)
- ✓ Measurable: isBnpl=true проставляется, список возвращается
- ✓ Achievable: keyword detection реализуемо
- ✓ Relevant: прямая ценность для пользователя
- ⚠️ Time-bound: нет SLA на время сканирования

**Security (✓):** JWT обязателен по AC.

**Minor gap:** Добавить в AC: "And scan completes within 500ms for ≤1000 transactions"

---

### US-2: Просмотр обязательств (88/100)

**INVEST:** 6/6 — полностью независима от US-1 (данные уже в DB).

**SMART:** 5/5 — карточки с конкретными полями, totalDebt с единицами.

**Security (✓):** Implicit — данные scope userId через JWT.

---

### US-3: Timeline платежей (80/100)

**INVEST:** 6/6.

**SMART (4/5):**
- ⚠️ Time-bound: нет SLA для рендеринга timeline

**Recommendation:** "Timeline renders within 300ms for ≤20 obligations"

---

### US-4: Управление обязательством (87/100)

**INVEST:** 6/6.

**SMART:** 5/5 — dismiss + totalDebt пересчёт явно указаны.

**Security (✓):** IDOR защита — в Specification.md явно задокументировано через Pseudocode (findFirst с userId scope).

## BDD Scenarios

### US-1: Сканирование BNPL

```gherkin
Scenario: Successful BNPL scan with Долями transactions
  Given user has JWT token
  And user has 2 transactions with merchant "DOLYAMI MVIDEO", amount 250000 kopecks, 14 days apart
  When POST /bnpl/scan is called
  Then response status is 200
  And response.found equals 1
  And response.obligations[0].bnplService equals "Долями"
  And transactions are updated with isBnpl=true

Scenario: Scan with no BNPL transactions
  Given user has JWT token
  And user has 10 regular transactions (no BNPL keywords)
  When POST /bnpl/scan is called
  Then response status is 200
  And response.found equals 0
  And response.obligations is empty array

Scenario: Scan without authentication
  Given no Authorization header
  When POST /bnpl/scan is called
  Then response status is 401

Scenario: Idempotent scan (called twice)
  Given user has Долями transactions
  When POST /bnpl/scan is called twice
  Then second call upserts (no duplicates)
  And response.found is same both times
```

### US-4: IDOR Security

```gherkin
Scenario: User cannot dismiss another user's obligation
  Given userA has BnplObligation with id "ob-123"
  And userB is authenticated with their JWT
  When userB sends PATCH /bnpl/ob-123 { status: "dismissed" }
  Then response status is 404
  And userA's obligation is unchanged
```

## Architecture Validation

✓ Consistent with `docs/Architecture.md`:
- Routes are thin controllers
- BnplDetector is a pure service (no HTTP context)
- Prisma queries scoped by userId
- Zod validation on all endpoints

✓ Pseudocode completeness:
- All 3 algorithms fully specified (detectProvider, detect, computeSummary)
- All 3 API endpoints specified with request/response contracts
- State machine defined

## Verdict

**Score: 85/100 — PASSED**

No BLOCKED items. Minor recommendations (non-blocking):
1. US-1: Add perf bound to AC (scan < 500ms for 1000 txns)
2. US-3: Add render SLA to AC (timeline < 300ms)

These are already covered in `Refinement.md` as NFRs. Ready to implement.

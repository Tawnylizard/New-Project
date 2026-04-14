# Specification — Финансовые цели

> SPARC Phase 3 · SPECIFICATION  
> Дата: 2026-04-14

---

## User Stories

### US-001: Создание цели (FREE + PLUS)
```
As a Клёво user,
I want to create a savings goal with a name, target amount and optional deadline,
So that I can track my progress towards it.

Acceptance Criteria:
Given I am authenticated and have fewer than 1 active goal (FREE) or any count (PLUS)
When I submit a valid goal creation form
Then a goal is created with status ACTIVE and currentAmountKopecks = 0

Given I am a FREE user with 1 active goal
When I try to create another goal
Then I see a PLUS paywall with upgrade CTA
```

### US-002: Просмотр списка целей
```
As a Клёво user,
I want to see all my goals with a progress bar and key stats,
So that I know where I stand.

Acceptance Criteria:
Given I have at least one goal
When I open the Goals page
Then I see each goal with: name, progress bar (currentAmount/targetAmount), days remaining (if deadline set)
```

### US-003: Обновление прогресса
```
As a Клёво user,
I want to manually mark how much I've saved towards a goal,
So that my progress stays up to date.

Acceptance Criteria:
Given I have an active goal
When I enter a new currentAmount value
Then it is saved and the progress bar updates immediately

Given currentAmount >= targetAmount
When I save the update
Then the goal status is automatically set to COMPLETED
```

### US-004: AI-совет по цели (PLUS only)
```
As a PLUS subscriber,
I want to get an AI recommendation based on my real spending,
So that I know exactly what to cut to reach my goal faster.

Acceptance Criteria:
Given I am a PLUS user with an active goal and imported transactions
When I tap "Получить AI-совет"
Then within 5 seconds I receive a personalized advice based on my last 30 days of spending

Given YandexGPT is unavailable
When I tap "Получить AI-совет"
Then GigaChat is tried; if also unavailable — cached generic advice is shown

Given I am a FREE user
When I tap "Получить AI-совет"
Then I see the PLUS upgrade paywall
```

### US-005: Архивация и удаление цели
```
As a Клёво user,
I want to archive or delete a goal I no longer need,
So that my list stays clean.

Acceptance Criteria:
Given I have an active goal
When I select "Отказаться от цели"
Then status changes to ABANDONED and goal moves to archive section

When I select "Удалить"
Then the goal is permanently deleted after confirmation
```

---

## Feature Matrix

| Функция | FREE | PLUS | Реализация |
|---------|------|------|-----------|
| Создать цель | 1 активная | Без лимита | POST /goals + plan check |
| Просмотр целей | ✅ | ✅ | GET /goals |
| Обновить прогресс | ✅ | ✅ | PUT /goals/:id |
| Архивировать цель | ✅ | ✅ | PUT /goals/:id status=ABANDONED |
| Удалить цель | ✅ | ✅ | DELETE /goals/:id |
| AI-совет | ❌ Paywall | ✅ | POST /goals/:id/advice |
| Прогноз даты | ❌ Paywall | ✅ | В AI-совете |

---

## Goal Categories (enum)

```
SAVINGS          — Накопления (общее)
EMERGENCY_FUND   — Подушка безопасности
VACATION         — Путешествие / отпуск
GADGET           — Гаджет / техника
EDUCATION        — Обучение / курсы
HOUSING          — Жильё / ипотека первый взнос
OTHER            — Другое
```

---

## Non-Functional Requirements

| Параметр | Значение |
|----------|---------|
| AI timeout | 5 сек → fallback |
| AI retry | До 2 раз при plausibility fail |
| API latency (non-AI) | < 200ms |
| Max goals (PLUS) | 50 (soft limit) |
| AI cache | Redis TTL 2ч per goalId+spendingHash |
| Disclaimer | Каждый AI-ответ: «Это информационный сервис» |
| Money | Всегда kopecks (Int), display /100 |

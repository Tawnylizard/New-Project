# Final Summary — Финансовые цели

> Дата: 2026-04-14

---

## Overview

«Финансовые цели» — premium v1.0 функция Клёво. Пользователь создаёт накопительную цель, вручную обновляет прогресс, а PLUS-подписчики получают персонализированный AI-совет на основе реальных трат (из импортированного CSV).

## Problem & Solution

**Problem:** Российский Gen Z копит хаотично — нет визуальной цели и связи трат с накоплением.  
**Solution:** CRUD-модуль целей + AI-анализ категорий трат → конкретный план экономии. Монетизация через PLUS-paywall на AI-советах.

## Target Users

- Накопитель: копит на конкретное (отпуск, гаджет) — визуальный прогресс
- Должник: BNPL + цели — AI показывает, где срезать
- Дисциплинированный: подушка безопасности — AI-план без банковской интеграции

## Key Features

1. **CRUD целей** — создание, просмотр, обновление прогресса, архивация/удаление
2. **FREE limit** — 1 активная цель (habit formation без полной ценности)
3. **AI-советы (PLUS)** — анализ 30-дневных трат → конкретный план экономии
4. **Auto-complete** — при currentAmount ≥ targetAmount статус → COMPLETED

## Technical Approach

- **Architecture:** Distributed Monolith (extends existing Клёво arch)
- **New files:** 2 backend (route + service), 4 frontend (page + 3 components), 1 DB migration
- **AI:** YandexGPT → GigaChat → cached fallback (существующий паттерн)
- **Cache:** Redis TTL 2ч per goalId+spendingHash
- **Money:** Всегда kopecks (Int), display /100

## Success Metrics (90 дней)

| Метрика | Цель |
|---------|------|
| PLUS users с ≥1 goal | >60% |
| AI advice triggered | >40% целей |
| Goal completion rate | >20% |
| FREE→PLUS через goals paywall | 8% |

## Risks

| Риск | Митигация |
|------|-----------|
| LLM timeout | GigaChat fallback → cached advice |
| Пользователь забывает обновлять прогресс | Bot reminders (v1.1) |
| AI нерелевантный совет | Retry + content validation |

## Implementation Files

### Backend (apps/api)
- `routes/goals.ts` — 5 endpoints (CRUD + advice)
- `services/GoalService.ts` — бизнес-логика + AI

### Frontend (apps/tma)
- `pages/Goals.tsx` — список целей
- `components/GoalCard.tsx` — карточка + прогресс
- `components/CreateGoalModal.tsx` — форма создания
- `components/UpdateProgressModal.tsx` — обновление прогресса

### Database (packages/db)
- Новая модель `FinancialGoal` + enums `GoalCategory`, `GoalStatus`
- Prisma migration

### Shared (packages/shared)
- Типы `FinancialGoal`, `GoalCategory`, `GoalStatus`, `CreateGoalInput`, `UpdateGoalInput`

## Documentation Package

- [PRD.md](PRD.md) — Product Requirements
- [Research_Findings.md](Research_Findings.md) — Market & Tech Research
- [Solution_Strategy.md](Solution_Strategy.md) — Problem Analysis
- [Specification.md](Specification.md) — User Stories & Acceptance Criteria
- [Pseudocode.md](Pseudocode.md) — Algorithms & API Contracts
- [Architecture.md](Architecture.md) — System Design
- [Refinement.md](Refinement.md) — Edge Cases & Tests
- [Completion.md](Completion.md) — Deployment & Monitoring

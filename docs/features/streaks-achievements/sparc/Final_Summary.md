# Final Summary — Стрики и ачивки

> SPARC Synthesis · FINAL SUMMARY  
> Дата: 2026-04-14

---

## Overview

**Стрики и ачивки** — gamification-слой для Клёво. Два типа стриков (Import Streak + Spending Streak) и 9 достижений-ачивок мотивируют пользователей регулярно взаимодействовать с приложением. Ачивки шарятся в Telegram, создавая органический вирусный loop.

## Problem & Solution

**Problem:** Низкий retention — пользователи открывают Клёво один раз и уходят. Нет привычки возвращаться.

**Solution:** Habit loop через streaks (visual reward за последовательность) + milestone achievements (разовые награды за реальные действия) + Telegram-share (социальное давление).

## Target Users

Все пользователи Клёво (FREE + PLUS), Gen Z 18–28 лет. Ачивки доступны всем бесплатно — история стрика только PLUS.

## Key Features

1. **Import Streak** — счётчик последовательных дней с активностью. Grace period 1 день. Показывается на главном экране виджетом.
2. **Spending Streak** — счётчик последовательных недель с тратами < предыдущей недели. Вычисляется еженедельным cron-джобом.
3. **9 Достижений** — FIRST_IMPORT, WEEK_STREAK, MONTH_STREAK, FIRST_ROAST, GOAL_COMPLETE, SUBSCRIPTION_KILLER, BUDGET_MASTER, SOCIAL_SHARER, REFERRAL_ACE. Event-driven, idempotent, instant unlock.

## Technical Approach

- **Architecture:** Distributed Monolith, интегрируется в существующие `apps/api` и `apps/tma`
- **DB:** 2 новые таблицы: `UserStreak` (1 row/user) + `UserAchievement` (≤9 rows/user)
- **Cache:** Redis `streak:{userId}` TTL=1h для горячего пути
- **Cron:** `node-cron` еженедельно для spending streak computation
- **Key Differentiator:** Telegram-native шеринг ачивок через `Telegram.WebApp.shareMessage`

## Research Highlights

1. Grace period (+1 день) критически важен — без него 40% пользователей бросают после первого пропуска
2. Telegram-шеринг ачивок — уникально для РФ рынка (ни один конкурент не имеет)
3. Все ачивки FREE → выше MAU → конверсия в PLUS через другие premium-фичи

## Success Metrics

| Метрика | Цель | Срок |
|---------|------|------|
| DAU/MAU ratio | +15% | 30 дней |
| Retention 30d | > 35% | 60 дней |
| Ачивок разблокировано | > 70% пользователей | 30 дней |
| Шерингов ачивок | > 10% активных | 30 дней |

## Timeline

| Phase | Features | Status |
|-------|----------|--------|
| v1.0 | Import Streak, Spending Streak, 9 ачивок, Share | Реализация |
| v2.0 | Push-уведомления, streak freeze, leaderboards | Planned |

## Risks & Mitigations

| Риск | Mitigation |
|------|------------|
| Ачивки воспринимаются как детские | Дизайн в стиле роаст-режима — с характером |
| Накрутка стрика | Импорт CSV — реальное действие, не кликбейт |
| Cron fails on serverless | Fallback: run at API startup + health check |

## Immediate Next Steps

1. Migrate DB: добавить UserStreak + UserAchievement + enum
2. Implement StreakService + AchievementService (с тестами 100%)
3. Wire triggers в существующие routes (transactions, roast, goals, subscriptions)
4. Implement TMA: AchievementsPage + StreakWidget
5. Validate: все 9 ачивок разблокируются корректно

## Documentation Package

- PRD.md — Product Requirements
- Research_Findings.md — Market & Tech Research
- Solution_Strategy.md — Problem Analysis & TRIZ
- Specification.md — User Stories & API Contracts
- Pseudocode.md — Algorithms & Data Flow
- Architecture.md — System Design & DB Schema
- Refinement.md — Edge Cases & Test Scenarios
- Completion.md — Deployment & Operations

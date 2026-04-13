# PRD: Subscription Hunter (Охотник на подписки-паразиты)

## Overview

Автоматически обнаруживает рекуррентные платежи в транзакциях пользователя. Показывает «подписки-паразиты» — сервисы, которые списывают деньги регулярно. Позволяет отмечать каждую подписку как паразита или игнорировать.

## Problem Statement

Российский Gen Z подключает подписки импульсивно и забывает их отменять. В среднем: 3–5 забытых подписок = ₽1 500–4 000/мес утечки. Пользователь не знает, что теряет, пока ему не покажут.

## Target Users

Пользователи Клёво с загруженными транзакциями (CSV за 2+ месяца).

## Scope

### Already Implemented (out of scope for this sprint)
- Detection algorithm (`SubscriptionDetector.ts`)
- DB model (`DetectedSubscription`)
- List API (`GET /subscriptions`)
- Status update API (`PATCH /subscriptions/:id`)
- TMA page (`Subscriptions.tsx`)

### In Scope (this sprint)
1. **Scan endpoint** — `POST /subscriptions/scan` triggers detection, upserts to DB
2. **Route tests** — integration tests for all subscription endpoints
3. **Scan trigger UI** — button in TMA to trigger scan when no subscriptions detected

## Success Metrics

- Scan completes in < 500ms for 1 000 transactions
- Zero false positives on 90-day test dataset
- Users who scan see ≥ 1 subscription detected (realistic dataset)

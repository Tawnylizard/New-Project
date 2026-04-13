# Final Summary: BNPL-трекер

## Overview

BNPL-трекер — автоматическое обнаружение и агрегация обязательств по рассрочке из банковских выписок пользователя Клёво. Поддерживает четыре российских BNPL-провайдера: Долями, Сплит, Подели, Яндекс Сплит.

## Problem & Solution

**Problem:** Платежи по рассрочке разбросаны по выпискам и нескольким приложениям. Пользователь не знает суммарный долг.

**Solution:** Keyword-детекция провайдера + группировка по паттерну (сумма + интервал) → BnplObligation с прогрессом и датой следующего платежа.

## Target Users

Gen Z 18–28 лет, активные пользователи Долями/Сплит, импортировавшие CSV в Клёво.

## Key Features (MVP)

1. **Scan** — POST /bnpl/scan детектирует BNPL из транзакций
2. **List** — GET /bnpl возвращает obligations + summary (totalDebt, nextPayment)
3. **Timeline** — хронологическая лента будущих платежей
4. **Dismiss** — PATCH /bnpl/:id скрывает ошибочное обязательство

## Technical Approach

- **Architecture:** Vertical slice в существующем монорепо (Distributed Monolith)
- **Detection:** `BnplDetector.ts` — чистая функция, O(n), keyword dictionary
- **Storage:** новая модель `BnplObligation` в Prisma + migration
- **Pattern:** идентичен `SubscriptionDetector` (проверенный паттерн)
- **Reuse:** Transaction.isBnpl + Transaction.bnplService уже в схеме

## New Files (8)

```
apps/api/src/routes/bnpl.ts
apps/api/src/routes/bnpl.test.ts
apps/api/src/services/BnplDetector.ts
apps/api/src/services/BnplDetector.test.ts
apps/tma/src/pages/BNPL.tsx
apps/tma/src/components/BnplCard.tsx
apps/tma/src/components/BnplTimeline.tsx
packages/db/schema.prisma (modified + migration)
```

## Success Metrics

| Метрика | Цель |
|---|---|
| % пользователей с ≥1 BNPL | > 30% |
| Avg сессий с BNPL | > 2.5 / неделю |
| Scan coverage | > 60% от всех импортов |

## Immediate Next Steps

1. Применить Prisma migration (`add_bnpl_obligation`)
2. Реализовать `BnplDetector.ts` + тесты
3. Реализовать `routes/bnpl.ts` + тесты  
4. Реализовать TMA: `BNPL.tsx` + компоненты
5. Обновить roadmap: `bnpl-tracker → done`

# Completion: BNPL-трекер

## Pre-Deployment Checklist

- [ ] `packages/db` migration применена и проверена
- [ ] `BnplDetector.ts` — unit tests ≥ 90% coverage
- [ ] `bnpl.ts` route — integration tests проходят
- [ ] `BNPL.tsx` рендерит без ошибок в TMA
- [ ] GET /bnpl < 100ms на 50 obligations
- [ ] POST /bnpl/scan < 200ms на 1000 транзакций
- [ ] Zod validation на всех endpoints
- [ ] requireAuth проверен

## Deployment Sequence

1. Сгенерировать и применить Prisma migration: `npx prisma migrate dev --name add_bnpl_obligation`
2. Запустить `prisma generate` для обновления клиента
3. Деплой `apps/api` (новые routes/services)
4. Деплой `apps/tma` (новые pages/components)

## Rollback Procedure

1. Откатить деплой apps/api и apps/tma к предыдущим версиям
2. При необходимости: `npx prisma migrate resolve --rolled-back add_bnpl_obligation`

## Monitoring

| Метрика | Порог | Действие |
|---|---|---|
| POST /bnpl/scan p99 | > 500ms | Оптимизировать детектор |
| Error rate /bnpl/* | > 1% | Алерт в Slack |
| BnplObligation created/день | 0 после релиза 3+ дней | Проверить детектор |

## Handoff Checklists

### Development
- [ ] `BnplDetector` — чистая функция, без побочных эффектов
- [ ] Shared types экспортированы из `@klyovo/shared`
- [ ] Migration файл закоммичен в `packages/db/prisma/migrations/`

### QA
- [ ] Протестировать с реальным CSV Сбер (CP1251) с Долями
- [ ] Протестировать с реальным CSV Т-Банк с Сплит
- [ ] Проверить empty state (нет BNPL)
- [ ] Проверить dismiss и restore

# Completion — Финансовые цели

> SPARC Phase 7 · COMPLETION  
> Дата: 2026-04-14

---

## Pre-Deployment Checklist

- [ ] Prisma migration applied (`npx prisma migrate deploy`)
- [ ] All unit tests passing (`npm test` in apps/api)
- [ ] All integration tests passing
- [ ] TypeScript compilation clean (`tsc --noEmit`)
- [ ] ESLint clean
- [ ] AI disclaimer present in all generated advice
- [ ] PLUS plan enforcement tested manually
- [ ] Redis cache tested (second advice request returns cached)
- [ ] Fallback chain tested (YandexGPT off → GigaChat → cached)

---

## Deployment Sequence

1. Apply DB migration: `npx prisma migrate deploy`
2. Deploy API changes (Yandex Cloud Serverless function update)
3. Deploy TMA build (`npm run build` → upload to Yandex Object Storage)
4. Smoke test: create goal, update progress, request AI advice (PLUS)
5. Monitor error rate for 15 minutes post-deploy

---

## Rollback Procedure

1. Revert API deployment to previous function version (Yandex Cloud: revision rollback)
2. TMA: revert to previous static build
3. DB: migration rollback `npx prisma migrate dev --name rollback_financial_goals` (drop FinancialGoal table)
4. Check no data loss (FinancialGoal is new table — safe to drop)

---

## Monitoring & Alerting

| Метрика | Порог | Алерт |
|---------|-------|-------|
| /goals p99 latency | > 300ms | Slack #alerts |
| /goals/:id/advice p99 | > 6000ms | Slack #alerts |
| advice_llm_fallback_rate | > 20% | Slack #incidents |
| goal_create_403_rate | > 30% | Slack (may indicate limit friction) |
| Redis cache hit rate (advice) | < 30% | Info only |

---

## Key Logging Points

```typescript
// In GoalService
logger.info({ goalId, userId, plan }, 'goal.created')
logger.info({ goalId, userId, status }, 'goal.progress_updated')
logger.info({ goalId, userId, source: 'yandexgpt'|'gigachat'|'cache' }, 'goal.advice_generated')
logger.warn({ goalId, userId, error }, 'goal.advice_llm_failed')
```

---

## Handoff Checklist

### Development
- [ ] GoalService unit tests coverage ≥80%
- [ ] Integration tests for all 5 API endpoints
- [ ] TypeScript types exported from packages/shared

### QA
- [ ] Test FREE limit (1 goal max)
- [ ] Test PLUS unlimited goals
- [ ] Test AI advice with real PLUS account
- [ ] Test paywall on FREE account

### Operations
- [ ] Confirm FinancialGoal table in production PostgreSQL
- [ ] Confirm Redis keys `goal_advice:*` TTL=7200s
- [ ] Confirm rate limit key `rate:advice:*` TTL=3600s

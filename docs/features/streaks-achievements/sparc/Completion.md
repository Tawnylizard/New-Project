# Completion — Стрики и ачивки

> SPARC Phase 7 · COMPLETION  
> Дата: 2026-04-14

---

## Pre-Deployment Checklist

- [ ] Prisma migration applied (`npx prisma migrate deploy`)
- [ ] All unit tests passing (`npm test` in apps/api)
- [ ] TypeScript compilation clean (`tsc --noEmit`)
- [ ] ESLint clean
- [ ] StreakService coverage = 100%
- [ ] AchievementService coverage = 100%
- [ ] Cron job tested with manual trigger endpoint (dev-only)
- [ ] Redis cache hit/miss verified
- [ ] Achievement triggers verified in all route integrations

---

## Deployment Sequence

1. Apply DB migration: `npx prisma migrate deploy` (adds UserStreak, UserAchievement)
2. Deploy API changes (new routes + services + cron)
3. Deploy TMA build (`npm run build` → Yandex Object Storage)
4. Smoke test: import CSV → streak = 1, FIRST_IMPORT unlocked
5. Smoke test: check achievements page — shows 1 unlocked, 8 locked
6. Monitor error rate 15 min post-deploy

---

## Rollback Procedure

1. Revert API deployment to previous function version
2. Revert TMA to previous static build
3. DB: `UserStreak` and `UserAchievement` are new tables — safe to drop with migration rollback
4. No data loss to existing features

---

## Monitoring & Alerting

| Метрика | Порог | Алерт |
|---------|-------|-------|
| GET /streaks p99 | > 200ms (cache miss) | Slack #alerts |
| GET /achievements p99 | > 300ms | Slack #alerts |
| spendingStreakCron error rate | > 0 | Slack #incidents |
| Redis cache hit rate (streak) | < 60% | Info only |
| Achievement unlock errors | > 5/min | Slack #alerts |

---

## Key Logging Points

```typescript
logger.info({ userId, newStreak, wasReset }, 'streak.import_updated')
logger.info({ userId, achievementType }, 'achievement.unlocked')
logger.warn({ userId, error }, 'streak.redis_unavailable')
logger.info({ usersProcessed, errors }, 'cron.spending_streak_complete')
```

---

## Handoff Checklist

### Development
- [ ] StreakService unit tests: 100% coverage
- [ ] AchievementService unit tests: 100% coverage
- [ ] Route integration tests: all trigger events covered
- [ ] Cron job tested with mock data

### QA
- [ ] Import streak: day 1, 2, 7, 30
- [ ] Grace period: 2-day gap doesn't reset
- [ ] 3-day gap resets streak
- [ ] All 9 achievement conditions trigger correctly
- [ ] Idempotency: double-trigger doesn't duplicate achievement
- [ ] Share button opens Telegram share dialog

### Operations
- [ ] Cron job scheduled (node-cron or Yandex Scheduler)
- [ ] Redis keys `streak:*` confirmed TTL=3600
- [ ] UserStreak and UserAchievement tables in production PostgreSQL

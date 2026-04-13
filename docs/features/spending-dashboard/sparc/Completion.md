# Completion: Dashboard анализа трат

## Implementation Checklist

### Backend
- [ ] `apps/api/src/services/AnalyticsService.ts` — computeSummary with Redis cache
- [ ] `apps/api/src/routes/analytics.ts` — GET /analytics/summary route
- [ ] Register analyticsRoutes in `apps/api/src/index.ts`
- [ ] Add `AnalyticsSummaryResponse` type to `packages/shared/src/types.ts`
- [ ] Invalidate analytics cache on CSV import in `transactions.ts`
- [ ] Tests: `analytics.test.ts` (routes) + `AnalyticsService.test.ts`

### Frontend
- [ ] Update `Dashboard.tsx` — add PeriodSelector, SpendingSummaryCard, wire to analytics API
- [ ] Update `SpendingChart.tsx` — add CategoryList below pie chart
- [ ] Wire period state to React Query key

## Deployment

No DB migrations needed — uses existing Transaction model with groupBy.

Redis dependency: if `REDIS_URL` not set, AnalyticsService skips cache gracefully.

## Monitoring

Key metrics to watch:
- `GET /analytics/summary` p99 latency (target < 200ms)
- Redis cache hit rate (target > 80%)
- Error rate on analytics endpoint (target < 0.1%)

# Architecture: Dashboard анализа трат

## Component Diagram

```
TMA (React 18)                    API (Fastify 5)
─────────────────                 ─────────────────────
Dashboard.tsx                     analyticsRoutes
  │ period state                    │ GET /analytics/summary
  │                                 │ → AnalyticsService.computeSummary()
  ├── PeriodSelector                │     ├── Redis.get(key)
  │   (local tabs UI)               │     ├── prisma.groupBy (category)
  │                                 │     ├── prisma.aggregate (prev total)
  ├── SpendingSummaryCard           │     └── Redis.setex(key, 300)
  │   (total + delta %)             │
  │                                 └── Zod schema validation
  └── SpendingChart (enhanced)
      ├── PieChart (Recharts)
      └── CategoryList (top-5)
```

## New Files

| File | Type | Purpose |
|------|------|---------|
| `apps/api/src/routes/analytics.ts` | Backend | Analytics routes |
| `apps/api/src/services/AnalyticsService.ts` | Backend | Computation + caching |

## Modified Files

| File | Change |
|------|--------|
| `apps/api/src/index.ts` | Register analyticsRoutes |
| `apps/tma/src/pages/Dashboard.tsx` | Add PeriodSelector + SpendingSummaryCard |
| `apps/tma/src/components/SpendingChart.tsx` | Add CategoryList below chart |
| `packages/shared/src/types.ts` | Add AnalyticsSummaryResponse type |

## Technology Decisions

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Aggregation | Server-side (Prisma groupBy) | Client has up to 200 txns, DB is more efficient |
| Caching | Redis 5min TTL | Analytics rarely change, expensive to compute |
| State | React local state (useState) | Period selection is page-local, no need for global store |
| Charts | Recharts (already installed) | Consistent with existing SpendingChart |

## Redis Cache Strategy

```
Key:    analytics:{userId}:{period}
TTL:    300s (5 minutes)
Evict:  After CSV import (call redis.del pattern)
```

Cache invalidation on import:
- After `POST /transactions/import` → delete `analytics:{userId}:*`

## Consistency with project Architecture

- Uses existing Prisma instance from `@klyovo/db`
- Uses existing JWT auth via `requireAuth` plugin
- Follows thin-routes / service pattern
- All amounts in kopecks (integer)
- Zod schema on all route inputs

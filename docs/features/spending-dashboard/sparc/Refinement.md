# Refinement: Dashboard анализа трат

## Edge Cases

| Scenario | Input | Expected | Handling |
|----------|-------|----------|----------|
| No transactions | empty DB | Empty state with CTA | Return zeros, show "Load CSV" button |
| Single period data | data only in current | changePercent = 0 | previousTotalKopecks = 0, skip delta |
| All transactions same category | 100% one cat | One full pie slice | Works naturally |
| >6 categories | many cats | Show top-6 in chart, top-5 in list | Slice in service |
| Redis down | connection refused | Still works, slower | Try/catch → skip cache, compute from DB |
| Period with no prev data | new user, month 1 | No comparison shown | changePercent = null → hide delta badge |
| Very large amounts | > ₽1,000,000 | Formatted: ₽1 млн | Format with compact notation |

## Testing Strategy

### Unit Tests (AnalyticsService)
- `getPeriodRange('month')` returns correct start/end of current month
- `getPeriodRange('last_month')` returns prev month bounds
- `getPeriodRange('3months')` returns 3-month window
- `computeAnalytics` — mocked Prisma + Redis, verify aggregation logic
- Category percentage calculation sums to ~100%
- changePercent = 0 when no previous data

### Integration Tests (analytics routes)
- `GET /analytics/summary` without auth → 401
- `GET /analytics/summary?period=month` → 200 with correct shape
- `GET /analytics/summary?period=invalid` → 400 VALIDATION_ERROR
- Cache hit: second request uses Redis (spy on prisma.groupBy call count)

### Component Tests (Dashboard.tsx)
- Renders PeriodSelector with 3 tabs
- Switching period triggers new API call with correct period param
- Shows empty state when no data
- Shows delta as green when spending decreased
- Shows delta as red when spending increased

## Performance Optimizations

- Prisma `groupBy` instead of fetching all transactions and aggregating in JS
- Redis TTL 5min — analytics don't need real-time freshness
- Cache invalidation only on CSV import (not on every request)
- Pie chart renders top-6 slices only (no performance issues with Recharts)

## Security

- Always scope DB queries by `userId` from JWT (not from query params)
- Zod validate `period` query param (enum, not free string)
- Rate limiting: existing 100 req/min per user applies

## Technical Debt

- Redis client is not yet initialized in the project (workaround: skip cache if REDIS_URL not set)
- No custom date range — deferred to v1.0

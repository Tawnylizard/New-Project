# Pseudocode: Dashboard анализа трат

## Data Structures

```typescript
type AnalyticsPeriod = 'month' | 'last_month' | '3months'

interface PeriodRange {
  from: Date
  to: Date
}

interface CategoryStat {
  category: TransactionCategory
  totalKopecks: number
  percentage: number
  transactionCount: number
}

interface AnalyticsSummaryResponse {
  period: { from: string; to: string }
  totalKopecks: number
  previousTotalKopecks: number
  changePercent: number | null  // null when no previous data (new user)
  topCategories: CategoryStat[]
  transactionCount: number
}
```

## Core Algorithms

### Algorithm: getPeriodRange(period)
```
INPUT: period: AnalyticsPeriod
OUTPUT: { current: PeriodRange, previous: PeriodRange }

now = new Date()
currentMonth = startOfMonth(now)
nextMonth = endOfMonth(now)

IF period == 'month':
  current = { from: currentMonth, to: nextMonth }
  previous = { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) }
ELSE IF period == 'last_month':
  lastMonth = subMonths(now, 1)
  current = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
  previous = { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(subMonths(now, 2)) }
ELSE IF period == '3months':
  current = { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) }
  previous = { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(subMonths(now, 3)) }
ELSE:
  THROW Error('Invalid period value')

RETURN { current, previous }
```

### Algorithm: computeAnalytics(userId, period)
```
INPUT: userId: string, period: AnalyticsPeriod
OUTPUT: AnalyticsSummaryResponse

// Step 1: Check Redis cache
cacheKey = `analytics:${userId}:${period}`
cached = await redis.get(cacheKey)
IF cached: RETURN JSON.parse(cached)

// Step 2: Compute period ranges
{ current, previous } = getPeriodRange(period)

// Step 3: Fetch current transactions (aggregate in DB)
currentTxns = await prisma.transaction.groupBy({
  by: ['category'],
  where: { userId, transactionDate: { gte: current.from, lte: current.to } },
  _sum: { amountKopecks: true },
  _count: { id: true }
})

// Step 4: Fetch previous total
previousTotal = await prisma.transaction.aggregate({
  where: { userId, transactionDate: { gte: previous.from, lte: previous.to } },
  _sum: { amountKopecks: true }
})

// Step 5: Compute totals
// null-guard: Prisma groupBy returns null sum for empty groups
totalKopecks = SUM(currentTxns.map(r => r._sum.amountKopecks ?? 0))
previousTotalKopecks = previousTotal._sum.amountKopecks ?? 0
// null when no previous data (new user) to avoid misleading +∞%
changePercent = previousTotalKopecks > 0
  ? round((totalKopecks - previousTotalKopecks) / previousTotalKopecks * 100, 1)
  : null

// Step 6: Build top categories (top-5 for both chart and list)
topCategories = currentTxns
  .sort by (_sum.amountKopecks ?? 0) DESC
  .slice(0, 5)
  .map(row => ({
    category: row.category,
    totalKopecks: row._sum.amountKopecks ?? 0,
    percentage: totalKopecks > 0 ? round((row._sum.amountKopecks ?? 0) / totalKopecks * 100, 1) : 0,
    transactionCount: row._count.id
  }))

// Step 7: Build response
result = {
  period: { from: current.from.toISOString(), to: current.to.toISOString() },
  totalKopecks,
  previousTotalKopecks,
  changePercent,
  topCategories,
  transactionCount: SUM(currentTxns._count.id)
}

// Step 8: Cache 5 minutes
await redis.setex(cacheKey, 300, JSON.stringify(result))

RETURN result

CATCH (error):
  log.error('Analytics computation failed', { userId, period, error })
  THROW { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Failed to compute analytics' }
```

### Algorithm: invalidateAnalyticsCache(userId)
```
INPUT: userId: string
OUTPUT: void

// Called after POST /transactions/import
IF redis available:
  keys = await redis.keys(`analytics:${userId}:*`)
  FOR key IN keys:
    await redis.del(key)
// If Redis unavailable: skip silently (cache will expire naturally in 5 min)
```

## API Contracts

### GET /analytics/summary
```
Request:
  Headers: { Authorization: Bearer <jwt> }
  Query: { period?: 'month' | 'last_month' | '3months' }

Response (200): AnalyticsSummaryResponse

Response (401): { error: { code: 'UNAUTHORIZED', message: string } }
Response (400): { error: { code: 'VALIDATION_ERROR', message: string } }
Response (500): { error: { code: 'INTERNAL_ERROR', message: string } }
```

## Frontend State

```typescript
// Dashboard period state (local, no store needed)
const [period, setPeriod] = useState<AnalyticsPeriod>('month')

// React Query
const { data, isLoading } = useQuery({
  queryKey: ['analytics', period],
  queryFn: () => apiClient.get(`/analytics/summary?period=${period}`)
})
```

## Error Handling

- Redis unavailable → skip cache, compute from DB directly
- No transactions in period → return zeros, show empty state
- DB timeout → 500 error with INTERNAL_ERROR code

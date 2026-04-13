# Architecture: Subscription Hunter

## Component Map

```
apps/api/src/routes/subscriptions.ts    ← ADD: POST /scan endpoint
apps/api/src/services/SubscriptionDetector.ts  ← EXISTS (pure fn, no changes)
packages/db/schema.prisma               ← EXISTS (DetectedSubscription model)
packages/shared/src/types.ts            ← ADD: ScanSubscriptionsResponse
apps/tma/src/pages/Subscriptions.tsx    ← ADD: scan trigger button
```

## Data Flow (POST /subscriptions/scan)

```
TMA → POST /subscriptions/scan
  → requireAuth middleware (JWT validation)
  → fetch transactions from PostgreSQL
  → SubscriptionDetector.detect() [pure, in-memory]
  → prisma.upsert() × N [PostgreSQL]
  → prisma.findMany() [PostgreSQL]
  → return enriched list
```

## Consistency with docs/Architecture.md

- Auth via `requireAuth` Fastify hook (existing pattern)
- Zod validation on all inputs (empty body → no schema needed, but query validated)
- Prisma for all DB access (no raw SQL)
- Amounts always in kopecks (integer)
- Service layer stays pure — `SubscriptionDetector` has no DB dependency
- Route is thin controller: validate → call service → return

## No New Infrastructure

- No Redis cache needed (scan is fast, idempotent)
- No new DB migrations (schema already has `DetectedSubscription`)
- No external API calls

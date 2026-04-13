# Final Summary: Subscription Hunter

## Status

Core algorithm and UI already exist. Sprint delivers the missing integration layer.

## What's Being Built

1. `POST /subscriptions/scan` — ties SubscriptionDetector → DB upsert
2. `ScanSubscriptionsResponse` type in shared
3. Scan trigger button in TMA Subscriptions page
4. Route integration tests

## What Already Exists (no changes needed)

- `SubscriptionDetector.ts` — detection algorithm (8 tests, passing)
- `DetectedSubscription` Prisma model with `@@unique([userId, merchantName])`
- `GET /subscriptions` + `PATCH /subscriptions/:id` routes
- `Subscriptions.tsx` TMA page with status actions

## Implementation Order

1. Add `ScanSubscriptionsResponse` to `packages/shared/src/types.ts`
2. Add `POST /subscriptions/scan` to `apps/api/src/routes/subscriptions.ts`
3. Add scan trigger button to `apps/tma/src/pages/Subscriptions.tsx`
4. Write `apps/api/src/routes/subscriptions.test.ts`

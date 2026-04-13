# Refinement: Subscription Hunter

## Edge Cases

| Scenario | Input | Expected Behaviour |
|----------|-------|-------------------|
| No transactions | Empty DB | Scan returns `{ found: 0, subscriptions: [] }` |
| < 2 months data | 1 txn per merchant | Detector returns no subs (< 2 occurrences) |
| Scan run twice | Same txns | Idempotent upsert, no duplicates |
| User cancelled sub | Status = cancelled in DB | Scan update preserves status = cancelled |
| Amount variation > 10% | Irregular charges | Detector rejects, not returned |
| 1000 transactions | Large dataset | Scan < 500ms p95 |
| Concurrent scans | Two requests same userId | Upsert is atomic, no race condition |

## Test Plan

### Unit Tests (SubscriptionDetector.test.ts — existing)
- Monthly detection ✅
- Weekly detection ✅
- Too few occurrences → reject ✅
- Irregular gaps → reject ✅
- Amount variance > 10% → reject ✅

### Integration Tests (subscriptions.test.ts — new)
- `POST /subscriptions/scan` with valid JWT → 200, returns detected subs
- `POST /subscriptions/scan` without JWT → 401
- `POST /subscriptions/scan` idempotency → two scans → no duplicates
- `POST /subscriptions/scan` preserves cancelled status on re-scan
- `GET /subscriptions` returns list with annualCost enrichment
- `GET /subscriptions?status=active` filters correctly
- `PATCH /subscriptions/:id` updates status
- `PATCH /subscriptions/:id` wrong user → 404

## Security

- All routes behind `requireAuth` — userId always from JWT, never from request body
- No user can access another user's subscriptions (userId scoped in all queries)
- Upsert where clause includes `userId` → prevents cross-user pollution

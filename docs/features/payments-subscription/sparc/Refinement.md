# Refinement: payments-subscription

## Edge Cases Matrix

| Scenario | Input | Expected | Handling |
|----------|-------|----------|----------|
| Duplicate webhook | Same paymentId twice | 200 ok, no second DB write | idempotency check |
| Missing metadata | webhook with no userId/plan | 200 ok, warn log | null guard |
| Non-succeeded event | payment.pending | 200 ok, ignore | event type check |
| Invalid plan | plan="invalid" | 400 VALIDATION_ERROR | Zod enum |
| ЮKassa down | API timeout | 502 PAYMENT_FAILED | fetch error catch |
| env vars missing | YUKASSA_SECRET_KEY unset | 503 PAYMENT_FAILED | startup check |
| Invalid webhook auth | wrong shopId | 401 | timingSafeEqual |
| Expired plan | planExpiresAt < now | isActive=false in status | date comparison |
| FREE user checks status | plan=FREE | { plan: FREE, isActive: false } | correct |
| PLUS never expires | planExpiresAt=null | isActive=true | null = lifetime |

## Testing Strategy

### Unit Tests (services)
- PaymentService.createPayment — mock fetch, test all error paths
- processWebhook — test idempotency, plan date math
- getSubscriptionStatus — FREE vs PLUS, expiry logic

### Integration Tests (routes)
- POST /subscriptions/checkout — happy path, 503, 502, 400
- POST /webhooks/yukassa — valid auth + succeeded, duplicate, 401, non-succeeded event
- GET /subscriptions/status — PLUS user, FREE user, 401

## Security Hardening

1. `crypto.timingSafeEqual` on webhook — prevents timing oracle
2. Idempotency before DB write — prevents double-activation
3. Amount validation: must match expected plan price (anti-manipulation)
4. Metadata userId cross-check: must match existing user

## Technical Debt

- Auto-renewal (recurring) not implemented in v1 — manual renewal required
- No refund flow — manual via ЮKassa dashboard
- `planExpiresAt` not enforced server-side on every request — client-side check only (acceptable for v1)

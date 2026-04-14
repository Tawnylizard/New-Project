# Specification: payments-subscription

## User Stories

### US-1: Checkout
As a FREE user hitting the roast limit,  
I want to start a payment for Клёво Плюс,  
So that I can access unlimited roasts.

**AC:**
- Given authenticated user, When POST /subscriptions/checkout with valid plan, Then receive confirmationUrl within 3s
- Given missing YUKASSA env vars, When checkout, Then 503 PAYMENT_FAILED
- Given ЮKassa API error, When checkout, Then 502 PAYMENT_FAILED
- Given invalid plan value, When checkout, Then 400 VALIDATION_ERROR

### US-2: Webhook Activation
As the system,  
I want to process ЮKassa payment.succeeded webhooks,  
So that user's plan is upgraded immediately after payment.

**AC:**
- Given valid Basic auth + payment.succeeded + paid=true, When webhook, Then user.plan=PLUS, planExpiresAt set, KlyovoSubscription created
- Given duplicate paymentId, When webhook second time, Then 200 ok (idempotent, no DB write)
- Given invalid Basic auth, When webhook, Then 401
- Given payment.pending event (not succeeded), When webhook, Then 200 ok (ignore)
- Given missing userId in metadata, When webhook, Then 200 ok (warn + ignore)
- Given plus_monthly plan, Then planExpiresAt = now + 30 days
- Given plus_yearly plan, Then planExpiresAt = now + 365 days

### US-3: Status Check
As a logged-in user,  
I want to check my current plan and expiry date,  
So that I know when to renew.

**AC:**
- Given PLUS user, When GET /subscriptions/status, Then { plan: "PLUS", planExpiresAt: <date>, isActive: true }
- Given FREE user, When GET /subscriptions/status, Then { plan: "FREE", planExpiresAt: null, isActive: false }
- Given unauthenticated, When GET /subscriptions/status, Then 401

## API Contracts

### POST /subscriptions/checkout
```
Auth: Bearer JWT
Body: { plan: "plus_monthly" | "plus_yearly", returnUrl: string (URL) }
Response 200: { paymentId: string, confirmationUrl: string, amount: number }
Response 400: { error: { code: "VALIDATION_ERROR", message: string } }
Response 503: { error: { code: "PAYMENT_FAILED", message: string } }
```

### POST /webhooks/yukassa
```
Auth: Basic <shopId>:<secretKey> (from ЮKassa)
Body: YookassaWebhookPayload
Response 200: { ok: true }
Response 401: on invalid auth
```

### GET /subscriptions/status
```
Auth: Bearer JWT
Response 200: { plan: "FREE" | "PLUS", planExpiresAt: string | null, isActive: boolean }
```

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Checkout < 3s p95 |
| Idempotency | Same paymentId → no duplicate activation |
| Security | Webhook auth via timing-safe Basic auth compare |
| Compliance | ФЗ-54: receipt required in every payment |
| Data | Amounts always in kopecks (integer) |

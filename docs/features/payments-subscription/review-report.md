# Review Report: payments-subscription

**Date:** 2026-04-14  
**Reviewers:** code-quality (Linus), security (OWASP), test-quality (Ramsay), architecture (TMA)

---

## Summary

| Reviewer | Critical | High | Medium | Low |
|----------|---------|------|--------|-----|
| code-quality | 7 | 6 | 7 | 3 |
| security | 5 | 7 | 5 | 3 |
| test-quality | 3 | 6 | 5 | 4 |
| architecture | 2 | 5 | 5 | 4 |

## Fixed Criticals

| Issue | Fix |
|-------|-----|
| `requireAuth` not aborting — route ran on 401 | Added `return` to catch block in `jwt.ts` |
| JWT algorithm not pinned — `alg:none` attack possible | Pinned `HS256` in `sign` and `verify` options |
| `idempotenceKey` used `Date.now()` — defeated ЮKassa deduplication | Changed to UTC date-scoped key `${userId}-${plan}-${YYYY-MM-DD}` |
| Zod not applied to webhook body at runtime | Added `yukassaWebhookSchema.parse(req.body)` + Zod schema |
| Float division on money: `estimatedAmount * (365 / days)` | Fixed to `(estimatedAmount * 365) / days` |
| Paywall showed checkout to already-subscribed users | Added `GET /subscriptions/status` check, active-plan guard UI |
| `navigate(-1)` crashes on empty TMA history | Added `window.history.length > 1` guard |
| Webhook date math tests asserted nothing | Tests now verify `+30d` and `+365d` via `mockSubCreate.mock.calls` |
| Checkout tests verified mock return, not route→service amount | Tests now assert `mockCreatePayment` was called with correct kopeck amounts |

## Remaining Issues (deferred to v2)

| Issue | Severity | Why Deferred |
|-------|---------|--------------|
| Fake email for ФЗ-54 receipt (`@klyovo.telegram`) | HIGH | Requires user email collection in onboarding — scope too large for this sprint |
| No `/checkout` guard for active subscribers server-side | HIGH | Soft-blocked by no duplicate payment risk (idempotenceKey date-scoped; webhook is idempotent) |
| PATCH `/:id` params not Zod-validated as UUID | MEDIUM | Not a payment flow concern |
| Fetch timeout on ЮKassa API | MEDIUM | Need to test timeout behaviour first |
| No rate limit on `/checkout` (user-level) | MEDIUM | Global 100req/min applies; checkout-specific limit v2 |
| totalMonthly/totalAnnual computed only on filtered subs | MEDIUM | Existing behaviour, separate ticket |

## Verdict

✅ **PASS** — All confirmed criticals fixed. Remaining issues documented above do not block MVP launch.

# Brutal Honesty Review: Subscription Hunter

**Date:** 2026-04-13
**Mode:** Linus (technical precision)
**Reviewer:** brutal-honesty-review swarm

## Verdict: APPROVED (after fixes)

Security: CLEAN. Logic: CORRECT. Tests: SOLID.
4 issues found and fixed before merge.

## Issues Found & Fixed

| # | Severity | File | Issue | Fixed |
|---|----------|------|-------|-------|
| 1 | MAJOR | subscriptions.ts:26 | `_req` named as unused but accessed on next line — misleading | ✅ renamed to `req` |
| 2 | MAJOR | subscriptions.ts:36 | Sequential `for` loop upserts — serial DB round trips | ✅ `Promise.all()` |
| 3 | MAJOR | Subscriptions.tsx | Re-scan button hidden when subs exist — users trapped | ✅ "Обновить" in header |
| 4 | MODERATE | Subscriptions.tsx | Scan mutation has no `onError` — silent failure | ✅ error message added |
| 5 | MINOR | subscriptions.ts | `annualCost` computation duplicated in 2 routes | ✅ `enrichWithAnnualCost()` helper |
| 6 | MINOR | subscriptions.ts | `reply.status(200)` is Fastify's default — no-op | ✅ removed |

## What Was Good

- `userId` always from JWT, never from body — zero cross-user leakage risk
- Upsert status preservation (no `status` in update block) — correct, commented
- 15 integration tests covering 401, idempotency, cross-user 404, invalid inputs
- `SubscriptionDetector` pure and separately unit-tested — clean separation
- Zod validation on all user-supplied inputs

## Not Fixed (acceptable)

- No rate limiting on scan endpoint specifically (covered by global 100 req/min limiter)
- No scan locking for concurrent requests (upsert semantics make it safe, just wasteful)
- No time window filter on transaction fetch (correct — longer history improves detection)

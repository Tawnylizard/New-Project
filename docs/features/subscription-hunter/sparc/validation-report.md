# Requirements Validation Report: Subscription Hunter

**Date:** 2026-04-13
**Validator:** requirements-validator swarm (5 agents)
**Iteration:** 1/3

## Summary

- Stories analyzed: 3
- Average score: **78/100**
- Blocked: 0
- Status: ✅ READY FOR IMPLEMENTATION

## Results

| Story | Title | INVEST | SMART | Security | Score | Status |
|-------|-------|--------|-------|----------|-------|--------|
| US-01 | Trigger Subscription Scan | 6/6 ✓ | 4/5 | +5 | 78/100 | READY |
| US-02 | View Subscription Costs | 6/6 ✓ | 4/5 | +0 | 74/100 | READY |
| US-03 | Mark as Parasite | 6/6 ✓ | 5/5 | +5 | 83/100 | READY |

## Detailed Analysis

### US-01: Trigger Subscription Scan — 78/100

**INVEST:** 6/6 ✓
| Criterion | Pass | Note |
|-----------|------|------|
| Independent | ✓ | Scan endpoint is self-contained |
| Negotiable | ✓ | |
| Valuable | ✓ | "finds all recurring payments automatically" |
| Estimable | ✓ | ~2h implementation |
| Small | ✓ | Single endpoint |
| Testable | ✓ | Clear Gherkin AC |

**SMART:** 4/5 ⚠
| Criterion | Pass | Note |
|-----------|------|------|
| Specific | ✓ | POST /subscriptions/scan explicitly named |
| Measurable | ✓ | DB save is verifiable |
| Achievable | ✓ | |
| Relevant | ✓ | |
| Time-bound | ⚠ | AC doesn't mention <500ms — covered in NFR though |

**Note:** Response time SLA exists in NFR section (`p95 < 500ms`). AC could reference it but score is non-blocking.

### US-02: View Subscription Costs — 74/100

**INVEST:** 6/6 ✓

**SMART:** 4/5 ⚠
| Criterion | Pass | Note |
|-----------|------|------|
| Time-bound | ⚠ | No load time SLA in AC |

**Note:** Minor — page load is covered by general API SLAs.

### US-03: Mark as Parasite — 83/100

**INVEST:** 6/6 ✓
**SMART:** 5/5 ✓ — status transition is immediate and verifiable
**Security:** +5 — auth bypass scenario present in Refinement.md

## Cross-Document Coherence

| Check | Result |
|-------|--------|
| Spec ↔ Pseudocode | ✓ upsert semantics match |
| Pseudocode ↔ Architecture | ✓ components align |
| Architecture ↔ docs/Architecture.md | ✓ same patterns (requireAuth, Prisma, Zod, kopecks) |
| Security requirements | ✓ userId scoping, 404 for wrong user |

## BDD Scenarios

### POST /subscriptions/scan

```gherkin
Scenario: Successful scan finds subscriptions
  Given user has 90 days of transactions including 3x "netflix" at ~30-day intervals
  When user calls POST /subscriptions/scan with valid JWT
  Then response is 200 with found=1
  And DetectedSubscription record exists in DB for "netflix"

Scenario: Scan is idempotent
  Given scan has been run once
  When user calls POST /subscriptions/scan again
  Then no duplicate DetectedSubscription records are created

Scenario: Scan preserves cancelled status
  Given a subscription with status="cancelled" exists in DB
  When user runs POST /subscriptions/scan
  Then that subscription's status remains "cancelled"

Scenario: Unauthenticated scan attempt
  When POST /subscriptions/scan is called without Authorization header
  Then response is 401

Scenario: Cross-user isolation
  Given user A has subscriptions in DB
  When user B calls GET /subscriptions
  Then user B does not see user A's subscriptions

Scenario: Empty transaction history
  Given user has no transactions
  When POST /subscriptions/scan is called
  Then response is 200 with found=0 and empty subscriptions array
```

## Minor Improvements (non-blocking)

1. US-01 AC could reference the `< 500ms` SLA explicitly (already in NFR — acceptable)
2. US-02 could specify "page loads within Xs" — non-blocking, covered by general API SLAs

## Decision

**APPROVED — proceed to Phase 3: Implementation**
Average score 78/100 ≥ 70 threshold. No BLOCKED items.

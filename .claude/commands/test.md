---
description: Run tests, check coverage, or generate test stubs for Клёво.
  $ARGUMENTS: scope (all | api | tma | coverage | generate <service>)
---

# /test $ARGUMENTS

## Test Commands

### Run All Tests
```bash
# /test  OR  /test all
npm test --workspaces
```

### Run by Package
```bash
# /test api
npm test --workspace=apps/api

# /test tma
npm test --workspace=apps/tma
```

### Coverage Report
```bash
# /test coverage
npm test --workspaces -- --coverage
# Targets: services/ ≥80% lines, critical algorithms 100%
```

### Generate Test Stubs
```bash
# /test generate <ServiceName>
# Creates apps/api/src/services/<ServiceName>.test.ts with scaffolding
```

## Critical Test Scenarios

Run these before any PR:

### Auth
- Valid Telegram initData → 200 + JWT
- Expired initData (> 86400s) → 401
- Tampered hash → 401
- JWT expiry handling

### CSV Import
- Tinkoff UTF-8 with commas
- Sberbank CP1251 with semicolons
- Amount `1 234,56` → 123456 kopecks
- File too large (> 5MB) → reject
- Wrong format → graceful error

### Roast Generation
- YandexGPT success
- YandexGPT timeout → GigaChat fallback
- Both fail → cached fallback
- Free tier: 4th roast → 403

### Payments
- Valid ЮKassa webhook + signature → 200
- Invalid signature → 401
- Duplicate payment_id → 200 (idempotent, no-op)

## Coverage Targets

| Package | Lines | Branches |
|---------|-------|---------|
| apps/api/src/services/ | ≥80% | ≥70% |
| Critical algorithms | 100% | 90% |
| apps/api/src/routes/ | ≥60% | — |

## Debugging Test Failures

```bash
# Run single test file
npx jest apps/api/src/services/CsvParser.test.ts --verbose

# Watch mode during development
npx jest --watch

# Debug specific test
npx jest --testNamePattern="handles CP1251 encoding" --verbose
```

## Common Gotchas

- `coverageThreshold` (singular, not plural) in jest.config.js
- Use `.inject()` for Fastify tests, not real HTTP
- Use real DB for integration tests, not mocked Prisma
- Mock pattern: `jest.fn().mockResolvedValue()` not `jest.fn(async () => ...)`

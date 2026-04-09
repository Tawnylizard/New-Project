# Testing Rules — Клёво

## Coverage Targets

| Scope | Line Coverage | Branch Coverage |
|-------|--------------|-----------------|
| `apps/api/src/services/` | ≥80% | ≥70% |
| Critical algorithms (CsvParser, RoastGenerator) | 100% | 90% |
| `apps/api/src/routes/` | ≥60% | — |
| `apps/tma/src/` | ≥50% | — |

## Test Organization

```
apps/api/src/
├── routes/
│   ├── auth.ts
│   └── auth.test.ts        ← alongside source
├── services/
│   ├── CsvParser.ts
│   └── CsvParser.test.ts
packages/db/
└── seed.test.ts             ← integration tests
```

## Testing Stack

- **Unit + Integration**: Jest + ts-jest
- **HTTP testing**: Fastify `.inject()` — NOT real HTTP (faster, no port conflicts)
- **E2E**: Playwright (TMA browser automation)
- **DB**: Real Prisma against test PostgreSQL — NEVER mock the database

## Jest Configuration Rules

- Use `coverageThreshold` (singular) — NOT `coverageThresholds` (plural) — silently ignored
- Per-directory thresholds require a `global` key
- `ts-jest` requires `ts-node` as peer dependency

```js
// jest.config.js (correct)
module.exports = {
  coverageThreshold: {  // ← singular!
    global: { lines: 80 },
    './apps/api/src/services/': { lines: 80 }
  }
}
```

## Mock Patterns

```typescript
// ✅ Correct — satisfies jest.Mocked<T> in strict mode
const mockGenerate = jest.fn().mockResolvedValue('roast text')

// ❌ Wrong — fails strict mode
const mockGenerate = jest.fn(async () => 'roast text')
```

## Testing Critical Scenarios

### CSV Parsing
- UTF-8 Tinkoff CSV (commas)
- Windows-1251 Sberbank CSV (semicolons)
- Amount with comma decimal: `1 234,56`
- CP1251 fallback when UTF-8 fails
- Invalid file (too large, wrong format)

### Authentication
- Valid initData (correct HMAC, fresh auth_date)
- Expired initData (auth_date > 86400s old)
- Tampered hash (reject)
- Missing hash (reject)
- JWT expiry handling

### Roast Generation
- YandexGPT success path
- YandexGPT timeout → GigaChat fallback
- Both LLMs fail → cached fallback
- Content moderation retry (offensive content)

### Payments
- ЮKassa webhook with valid signature
- ЮKassa webhook with invalid signature (reject)
- Duplicate payment_id (idempotency — ignore)
- Free tier roast limit enforcement (3/month)

### Money Calculations
- Always integer kopecks throughout
- Sum of transactions (no float rounding errors)
- BNPL percentage calculation (use integer arithmetic)

## Integration Test Setup

```typescript
// Use Fastify inject — never real HTTP
const app = buildApp()  // your Fastify app factory
await app.ready()

const response = await app.inject({
  method: 'POST',
  url: '/auth/telegram',
  payload: { initData: mockInitData }
})

expect(response.statusCode).toBe(200)
```

## Do NOT Mock

- The database (Prisma) — use real test DB
- Redis in integration tests — use real Redis instance
- Telegram initData validation — test the real HMAC logic

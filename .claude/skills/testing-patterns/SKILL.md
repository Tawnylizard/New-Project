---
name: testing-patterns
description: >
  Testing patterns and templates for Клёво. Covers Fastify inject testing, CSV
  parsing tests, authentication tests, LLM fallback testing, and payment webhook
  testing. Use when writing tests, setting up Jest configuration, or debugging
  test failures. Triggers on "test", "testing", "how to test", "unit test", "coverage".
version: "1.0"
maturity: production
---

# Testing Patterns — Клёво

## Test Framework Setup

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {  // ← singular (not plural!)
    global: { lines: 80, branches: 70 },
    './apps/api/src/services/': { lines: 80 }
  },
  setupFilesAfterFramework: ['<rootDir>/test/setup.ts']
}
```

## Fastify Route Testing (inject pattern)

```typescript
import { buildApp } from '../src/app'

describe('POST /auth/telegram', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = buildApp({ logger: false })
    await app.ready()
  })

  afterAll(() => app.close())

  it('validates valid initData', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: generateValidInitData() }
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toHaveProperty('token')
  })

  it('rejects expired initData', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: generateExpiredInitData() }
    })
    expect(res.statusCode).toBe(401)
  })
})
```

## Service Unit Testing

```typescript
// CsvParser.test.ts
import { CsvParser } from './CsvParser'

describe('CsvParser', () => {
  it('parses Tinkoff CSV (UTF-8, commas)', async () => {
    const csv = readFixture('tinkoff-sample.csv')
    const result = await CsvParser.parse(csv, 'tbank')
    expect(result).toHaveLength(5)
    expect(result[0].amountKopecks).toBe(4720)  // ₽47.20
  })

  it('parses Sberbank CSV (CP1251, semicolons)', async () => {
    const csv = readFixture('sber-sample-cp1251.csv')
    const result = await CsvParser.parse(csv, 'sber')
    expect(result[0].merchantName).toBeDefined()
  })

  it('handles amount with comma decimal: "1 234,56"', async () => {
    const result = parseSberAmount('1 234,56')
    expect(result).toBe(123456)  // kopecks
  })
})
```

## Mock Patterns

```typescript
// ✅ Correct — satisfies jest.Mocked<T> in strict mode
const mockYandexGpt = {
  generate: jest.fn().mockResolvedValue('Ты потратил ₽47 тыс. за апрель...')
}

// ✅ With implementation
const mockPrisma = {
  transaction: {
    findMany: jest.fn().mockResolvedValue([...transactions])
  }
}

// ❌ Wrong in strict mode
const mockGenerate = jest.fn(async () => 'roast text')
```

## LLM Fallback Testing

```typescript
describe('RoastGenerator', () => {
  it('uses YandexGPT when available', async () => {
    mockYandexGpt.generate.mockResolvedValueOnce('roast text')
    const result = await generator.generate(summary, 'harsh')
    expect(mockYandexGpt.generate).toHaveBeenCalledOnce()
    expect(mockGigaChat.generate).not.toHaveBeenCalled()
  })

  it('falls back to GigaChat on YandexGPT timeout', async () => {
    mockYandexGpt.generate.mockRejectedValueOnce(new Error('timeout'))
    mockGigaChat.generate.mockResolvedValueOnce('fallback roast')
    const result = await generator.generate(summary, 'harsh')
    expect(result).toBe('fallback roast')
  })

  it('uses cached roast when both LLMs fail', async () => {
    mockYandexGpt.generate.mockRejectedValue(new Error('unavailable'))
    mockGigaChat.generate.mockRejectedValue(new Error('unavailable'))
    const result = await generator.generate(summary, 'harsh')
    expect(result).toContain('cached')  // fallback marker
  })
})
```

## Payment Testing

```typescript
describe('ЮKassa webhooks', () => {
  it('accepts webhook with valid signature', async () => {
    const payload = JSON.stringify({ type: 'payment.succeeded', object: { id: 'pay_123' } })
    const signature = computeYukassaSignature(payload, SECRET)

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { 'x-request-id': 'test-123' },
      payload
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects webhook with invalid signature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { 'x-request-id': 'test-123' },
      payload: JSON.stringify({ type: 'payment.succeeded' })
    })
    expect(res.statusCode).toBe(401)
  })

  it('ignores duplicate payment_id (idempotency)', async () => {
    // First call — process
    await processPayment('pay_123')
    // Second call — should be no-op
    await processPayment('pay_123')
    expect(prisma.klyovoSubscription.create).toHaveBeenCalledOnce()
  })
})
```

## Test Fixtures

```
apps/api/test/
├── fixtures/
│   ├── tinkoff-sample.csv     ← real Tinkoff format
│   ├── sber-sample-cp1251.csv ← real Sber format (CP1251)
│   ├── init-data-valid.txt    ← valid TMA initData
│   └── init-data-expired.txt  ← expired auth_date
└── setup.ts                   ← global test setup
```

## Database Tests

```typescript
// Use real Prisma — never mock the database
// Set TEST_DATABASE_URL in .env.test

beforeAll(async () => {
  await prisma.$executeRaw`TRUNCATE transactions, users CASCADE`
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

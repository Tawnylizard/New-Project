import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import type { FastifyInstance } from 'fastify'

const TEST_USER_ID = 'test-user-uuid'
const TEST_JWT_PAYLOAD = { userId: TEST_USER_ID, telegramId: '123456789', plan: 'FREE' }

const mockTxn = {
  id: 'txn-1',
  userId: TEST_USER_ID,
  amountKopecks: 45000,
  merchantName: 'Пятёрочка',
  merchantNormalized: 'пятёрочка',
  category: 'GROCERIES',
  transactionDate: new Date('2026-04-01'),
  source: 'CSV_SBER',
  rawDescription: 'Пятёрочка',
  isBnpl: false,
  bnplService: null,
  createdAt: new Date()
}

const mockPrisma = {
  transaction: {
    findMany: jest.fn().mockResolvedValue([mockTxn]),
    upsert: jest.fn().mockResolvedValue(mockTxn),
    create: jest.fn().mockResolvedValue(mockTxn)
  },
  detectedSubscription: {
    upsert: jest.fn().mockResolvedValue({})
  }
}

jest.unstable_mockModule('@klyovo/db', () => ({ prisma: mockPrisma }))
jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => null,
  default: async () => {}
}))
jest.unstable_mockModule('../plugins/jwt.js', () => ({
  requireAuth: jest.fn().mockImplementation(async (req: Record<string, unknown>) => {
    req['user'] = TEST_JWT_PAYLOAD
  }),
  JWT_TTL_SECONDS: 604800
}))

// Build a multipart form body with a file
function buildMultipart(boundary: string, csvContent: string, bankType = 'sber'): string {
  return (
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="bank_type"\r\n\r\n${bankType}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="test.csv"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    `${csvContent}\r\n` +
    `--${boundary}--`
  )
}

const SBER_CSV = [
  '"Дата";"Описание";"Счёт";"Дата операции";"Категория";"Сумма";"Валюта";"Статус";"Описание"',
  '"01.04.2026";"Пятёрочка";"40817...";"01.04.2026";"Продукты";"  -450,00";"RUB";"Выполнен";"Пятёрочка"',
  '"02.04.2026";"Яндекс Такси";"40817...";"02.04.2026";"Транспорт";"  -350,00";"RUB";"Выполнен";"Яндекс Такси"'
].join('\n')

describe('GET /transactions', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    mockPrisma.transaction.findMany.mockResolvedValue([mockTxn])
  })

  it('returns 200 with transaction list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ transactions: unknown[] }>()
    expect(Array.isArray(body.transactions)).toBe(true)
    expect(body.transactions).toHaveLength(1)
  })
})

describe('POST /transactions/import', () => {
  let app: FastifyInstance
  const boundary = 'testboundary123'

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    mockPrisma.transaction.upsert.mockResolvedValue(mockTxn)
    mockPrisma.transaction.findMany.mockResolvedValue([])
    mockPrisma.detectedSubscription.upsert.mockResolvedValue({})
  })

  it('returns 200 with import summary for valid Sber CSV', async () => {
    const payload = buildMultipart(boundary, SBER_CSV, 'sber')

    const response = await app.inject({
      method: 'POST',
      url: '/transactions/import',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: 'Bearer mock-token'
      },
      payload
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ importedCount: number; period: unknown; categoriesSummary: unknown[] }>()
    expect(typeof body.importedCount).toBe('number')
    expect(body.period).toBeDefined()
    expect(Array.isArray(body.categoriesSummary)).toBe(true)
  })

  it('returns 400 when no file is provided', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/transactions/import',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: 'Bearer mock-token'
      },
      payload: `--${boundary}--`
    })

    expect(response.statusCode).toBe(400)
  })
})

describe('POST /transactions (manual entry)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    mockPrisma.transaction.create.mockResolvedValue(mockTxn)
  })

  it('returns 201 for valid manual transaction', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: 'Bearer mock-token' },
      payload: {
        amountKopecks: 45000,
        merchantName: 'Пятёрочка',
        category: 'GROCERIES',
        transactionDate: '2026-04-01T00:00:00.000Z'
      }
    })

    expect(response.statusCode).toBe(201)
    const body = response.json<{ transaction: unknown }>()
    expect(body.transaction).toBeDefined()
  })

  it('returns 400 for missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: 'Bearer mock-token' },
      payload: { merchantName: 'Только имя' }
    })

    expect(response.statusCode).toBe(400)
  })
})

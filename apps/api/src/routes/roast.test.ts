import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import type { FastifyInstance } from 'fastify'

const TEST_USER_ID = 'test-user-uuid'
const TEST_JWT_PAYLOAD = { userId: TEST_USER_ID, telegramId: '123456789', plan: 'FREE' }

const mockSession = {
  id: 'roast-session-1',
  userId: TEST_USER_ID,
  roastText: 'Твои траты на кофе — это просто катастрофа.',
  mode: 'harsh',
  spendingSummary: {},
  sharedAt: null,
  createdAt: new Date()
}

const mockTransactions = Array.from({ length: 10 }, (_, i) => ({
  id: `txn-${i}`,
  userId: TEST_USER_ID,
  amountKopecks: 50000,
  merchantName: 'Яндекс Еда',
  merchantNormalized: 'яндекс еда',
  category: 'FOOD_CAFE',
  transactionDate: new Date(Date.now() - i * 86400000),
  source: 'CSV_SBER',
  rawDescription: null,
  isBnpl: false,
  bnplService: null,
  createdAt: new Date()
}))

const mockPrisma = {
  user: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: TEST_USER_ID, plan: 'FREE' })
  },
  roastSession: {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue(mockSession),
    findMany: jest.fn().mockResolvedValue([mockSession]),
    findFirst: jest.fn().mockResolvedValue(mockSession),
    update: jest.fn().mockResolvedValue({ ...mockSession, sharedAt: new Date() })
  },
  transaction: {
    findMany: jest.fn().mockResolvedValue(mockTransactions)
  },
  detectedSubscription: {
    count: jest.fn().mockResolvedValue(2)
  }
}

jest.unstable_mockModule('@klyovo/db', () => ({ prisma: mockPrisma }))
jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => ({ get: async () => null, set: async () => 'OK' }),
  default: async () => {}
}))
jest.unstable_mockModule('../plugins/jwt.js', () => ({
  requireAuth: jest.fn().mockImplementation(async (req: Record<string, unknown>) => {
    req['user'] = TEST_JWT_PAYLOAD
  }),
  JWT_TTL_SECONDS: 604800
}))
jest.unstable_mockModule('../services/RoastGenerator.js', () => ({
  RoastGenerator: {
    generate: jest.fn().mockResolvedValue('Твои траты на кофе — это просто катастрофа.')
  }
}))

describe('POST /roast/generate', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: TEST_USER_ID, plan: 'FREE' })
    mockPrisma.roastSession.count.mockResolvedValue(0)
    mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions)
    mockPrisma.roastSession.create.mockResolvedValue(mockSession)
    mockPrisma.detectedSubscription.count.mockResolvedValue(2)
  })

  it('returns 200 with roastId, roastText and spendingSummary', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/roast/generate',
      headers: { authorization: 'Bearer mock-token' },
      payload: { mode: 'harsh', periodDays: 30 }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ roastId: string; roastText: string; spendingSummary: unknown; shareUrl: string }>()
    expect(body.roastId).toBe('roast-session-1')
    expect(typeof body.roastText).toBe('string')
    expect(body.spendingSummary).toBeDefined()
    expect(body.shareUrl).toContain('roast_')
  })

  it('returns 402 when free plan monthly limit reached', async () => {
    mockPrisma.roastSession.count.mockResolvedValue(3)

    const response = await app.inject({
      method: 'POST',
      url: '/roast/generate',
      headers: { authorization: 'Bearer mock-token' },
      payload: { mode: 'harsh', periodDays: 30 }
    })

    expect(response.statusCode).toBe(402)
    const body = response.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('PLAN_LIMIT')
  })

  it('returns 400 when fewer than 5 transactions', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions.slice(0, 3))

    const response = await app.inject({
      method: 'POST',
      url: '/roast/generate',
      headers: { authorization: 'Bearer mock-token' },
      payload: { mode: 'soft', periodDays: 30 }
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('INSUFFICIENT_DATA')
  })

  it('returns 400 for invalid mode', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/roast/generate',
      headers: { authorization: 'Bearer mock-token' },
      payload: { mode: 'ultra', periodDays: 30 }
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 for invalid periodDays', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/roast/generate',
      headers: { authorization: 'Bearer mock-token' },
      payload: { mode: 'harsh', periodDays: 45 }
    })

    expect(response.statusCode).toBe(400)
  })

  it('paid plan skips roast count check', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: TEST_USER_ID, plan: 'PLUS' })
    mockPrisma.roastSession.count.mockResolvedValue(999)

    const response = await app.inject({
      method: 'POST',
      url: '/roast/generate',
      headers: { authorization: 'Bearer mock-token' },
      payload: { mode: 'harsh', periodDays: 30 }
    })

    expect(response.statusCode).toBe(200)
    expect(mockPrisma.roastSession.count).not.toHaveBeenCalled()
  })
})

describe('GET /roast/history', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })

  it('returns 200 with sessions array', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/roast/history',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ sessions: unknown[] }>()
    expect(Array.isArray(body.sessions)).toBe(true)
    expect(body.sessions).toHaveLength(1)
  })
})

describe('POST /roast/:id/share', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    mockPrisma.roastSession.findFirst.mockResolvedValue(mockSession)
    mockPrisma.roastSession.update.mockResolvedValue({ ...mockSession, sharedAt: new Date() })
  })

  it('returns 200 with shared: true', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/roast/roast-session-1/share',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ shared: boolean }>()
    expect(body.shared).toBe(true)
  })

  it('returns 404 for session belonging to another user', async () => {
    mockPrisma.roastSession.findFirst.mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/roast/wrong-session-id/share',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

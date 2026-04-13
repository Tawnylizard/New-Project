import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import type { FastifyInstance } from 'fastify'

const TEST_USER_ID = 'sub-route-test-user'
const TEST_JWT_PAYLOAD = { userId: TEST_USER_ID, telegramId: '111', plan: 'FREE' }

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockFindManyTransactions = jest.fn()
const mockFindManyDetectedSubs = jest.fn()
const mockFindFirstDetectedSub = jest.fn()
const mockUpsertDetectedSub = jest.fn()
const mockUpdateDetectedSub = jest.fn()
const mockFindUniqueOrThrowUser = jest.fn()
const mockCreatePayment = jest.fn()

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: {
    transaction: { findMany: mockFindManyTransactions },
    detectedSubscription: {
      findMany: mockFindManyDetectedSubs,
      findFirst: mockFindFirstDetectedSub,
      upsert: mockUpsertDetectedSub,
      update: mockUpdateDetectedSub
    },
    user: { findUniqueOrThrow: mockFindUniqueOrThrowUser }
  }
}))

jest.unstable_mockModule('../services/PaymentService.js', () => ({
  PaymentService: { createPayment: mockCreatePayment }
}))

jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK')
  }),
  default: async () => {}
}))

const mockRequireAuth = jest.fn().mockImplementation(async (req: Record<string, unknown>) => {
  req['user'] = TEST_JWT_PAYLOAD
})

jest.unstable_mockModule('../plugins/jwt.js', () => ({
  requireAuth: mockRequireAuth,
  JWT_TTL_SECONDS: 604800
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    userId: TEST_USER_ID,
    amountKopecks: 99900,
    merchantName: 'Netflix',
    merchantNormalized: 'netflix',
    category: 'SUBSCRIPTIONS',
    source: 'CSV_TBANK',
    rawDescription: null,
    isBnpl: false,
    bnplService: null,
    transactionDate: new Date(),
    createdAt: new Date(),
    ...overrides
  }
}

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    userId: TEST_USER_ID,
    merchantName: 'netflix',
    estimatedAmount: 99900,
    frequencyDays: 30,
    lastChargeDate: new Date('2024-03-15'),
    occurrences: 3,
    status: 'active',
    createdAt: new Date(),
    ...overrides
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /subscriptions/scan', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockFindManyTransactions.mockResolvedValue([
      makeTransaction({ transactionDate: new Date(Date.now() - 60 * 86400_000) }),
      makeTransaction({ transactionDate: new Date(Date.now() - 30 * 86400_000) })
    ])
    mockUpsertDetectedSub.mockResolvedValue(makeSub())
    mockFindManyDetectedSubs.mockResolvedValue([makeSub()])
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Требуется авторизация'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })
    const res = await app.inject({ method: 'POST', url: '/subscriptions/scan' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with found count and subscriptions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ found: number; subscriptions: unknown[] }>()
    expect(body.found).toBe(1)
    expect(body.subscriptions).toHaveLength(1)
  })

  it('upserts each detected subscription to DB', async () => {
    await app.inject({
      method: 'POST',
      url: '/subscriptions/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(mockUpsertDetectedSub).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_merchantName: { userId: TEST_USER_ID, merchantName: 'netflix' } },
        create: expect.objectContaining({ userId: TEST_USER_ID, merchantName: 'netflix', status: 'active' }),
        update: expect.not.objectContaining({ status: expect.anything() })
      })
    )
  })

  it('preserves existing status on re-scan (no status in update)', async () => {
    await app.inject({
      method: 'POST',
      url: '/subscriptions/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    const upsertCall = mockUpsertDetectedSub.mock.calls[0]?.[0] as { update: Record<string, unknown> }
    expect(upsertCall?.update).not.toHaveProperty('status')
  })

  it('returns found=0 when no subscriptions detected', async () => {
    // Only one transaction — detector needs ≥2 to detect
    mockFindManyTransactions.mockResolvedValue([makeTransaction()])
    mockFindManyDetectedSubs.mockResolvedValue([])

    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ found: number; subscriptions: unknown[] }>()
    expect(body.found).toBe(0)
    expect(body.subscriptions).toHaveLength(0)
    expect(mockUpsertDetectedSub).not.toHaveBeenCalled()
  })

  it('enriches subscriptions with annualCost', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    const body = res.json<{ subscriptions: Array<{ annualCost: number; estimatedAmount: number; frequencyDays: number }> }>()
    const sub = body.subscriptions[0]!
    expect(sub.annualCost).toBe(Math.round(sub.estimatedAmount * (365 / sub.frequencyDays)))
  })
})

describe('GET /subscriptions', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockFindManyDetectedSubs.mockResolvedValue([makeSub()])
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Требуется авторизация'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })
    const res = await app.inject({ method: 'GET', url: '/subscriptions' })
    expect(res.statusCode).toBe(401)
  })

  it('returns subscriptions list with annualCost', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ subscriptions: Array<{ annualCost: number }> }>()
    expect(body.subscriptions[0]).toHaveProperty('annualCost')
  })

  it('passes status filter to prisma', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions?status=active',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    expect(mockFindManyDetectedSubs).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TEST_USER_ID, status: 'active' } })
    )
  })

  it('returns 400 for invalid status value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions?status=unknown',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns totalMonthly and totalAnnual for active subs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions',
      headers: { authorization: 'Bearer mock-token' }
    })

    const body = res.json<{ totalMonthly: number; totalAnnual: number }>()
    expect(body.totalMonthly).toBeGreaterThanOrEqual(0)
    expect(body.totalAnnual).toBeGreaterThanOrEqual(0)
  })
})

describe('PATCH /subscriptions/:id', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockFindFirstDetectedSub.mockResolvedValue(makeSub())
    mockUpdateDetectedSub.mockResolvedValue(makeSub({ status: 'cancelled' }))
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Требуется авторизация'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })
    const res = await app.inject({ method: 'PATCH', url: '/subscriptions/sub-1', payload: { status: 'cancelled' } })
    expect(res.statusCode).toBe(401)
  })

  it('updates subscription status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/subscriptions/sub-1',
      headers: { authorization: 'Bearer mock-token' },
      payload: { status: 'cancelled' }
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdateDetectedSub).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'cancelled' } })
    )
  })

  it('returns 404 when subscription not found or belongs to another user', async () => {
    mockFindFirstDetectedSub.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: '/subscriptions/other-user-sub',
      headers: { authorization: 'Bearer mock-token' },
      payload: { status: 'cancelled' }
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/subscriptions/sub-1',
      headers: { authorization: 'Bearer mock-token' },
      payload: { status: 'invalid-status' }
    })

    expect(res.statusCode).toBe(400)
  })
})

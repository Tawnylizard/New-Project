import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import type { FastifyInstance } from 'fastify'

const TEST_USER_ID = 'bnpl-route-test-user'
const TEST_JWT_PAYLOAD = { userId: TEST_USER_ID, telegramId: '222', plan: 'FREE' }

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockFindManyTransactions = jest.fn()
const mockFindManyBnpl = jest.fn()
const mockFindFirstBnpl = jest.fn()
const mockUpsertBnpl = jest.fn()
const mockUpdateBnpl = jest.fn()
const mockUpdateManyTransactions = jest.fn()

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: {
    transaction: {
      findMany: mockFindManyTransactions,
      updateMany: mockUpdateManyTransactions
    },
    bnplObligation: {
      findMany: mockFindManyBnpl,
      findFirst: mockFindFirstBnpl,
      upsert: mockUpsertBnpl,
      update: mockUpdateBnpl
    }
  }
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTxn(overrides: Record<string, unknown> = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    userId: TEST_USER_ID,
    amountKopecks: 250000,
    merchantName: 'DOLYAMI MVIDEO',
    merchantNormalized: 'DOLYAMI MVIDEO',
    category: 'MARKETPLACE',
    source: 'CSV_TBANK',
    rawDescription: null,
    isBnpl: false,
    bnplService: null,
    transactionDate: new Date('2025-01-01'),
    createdAt: new Date(),
    ...overrides
  }
}

function makeObligation(overrides: Record<string, unknown> = {}) {
  const nextPaymentDate = new Date(Date.now() + 7 * 86400_000)
  return {
    id: 'ob-1',
    userId: TEST_USER_ID,
    bnplService: 'Долями',
    merchantName: 'DOLYAMI MVIDEO',
    merchantDisplay: 'MVIDEO',
    installmentAmount: 250000,
    totalInstallments: 4,
    paidInstallments: 2,
    firstPaymentDate: new Date('2025-01-01'),
    lastPaymentDate: new Date('2025-01-15'),
    nextPaymentDate,
    frequencyDays: 14,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// ─── POST /bnpl/scan ──────────────────────────────────────────────────────────

describe('POST /bnpl/scan', () => {
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
    mockUpdateManyTransactions.mockResolvedValue({ count: 0 })
    mockFindManyBnpl.mockResolvedValue([makeObligation()])
    mockUpsertBnpl.mockResolvedValue(makeObligation())
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })
    const res = await app.inject({ method: 'POST', url: '/bnpl/scan' })
    expect(res.statusCode).toBe(401)
  })

  it('returns found=0 when no BNPL transactions', async () => {
    mockFindManyTransactions.mockResolvedValue([
      makeTxn({ merchantNormalized: 'MAGNIT', amountKopecks: 50000 })
    ])
    mockFindManyBnpl.mockResolvedValue([])

    const res = await app.inject({
      method: 'POST',
      url: '/bnpl/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ found: number; obligations: unknown[] }>()
    expect(body.found).toBe(0)
    expect(mockUpsertBnpl).not.toHaveBeenCalled()
  })

  it('detects and returns BNPL obligations when transactions match', async () => {
    mockFindManyTransactions.mockResolvedValue([
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-01') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-15') })
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/bnpl/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ found: number; obligations: unknown[] }>()
    expect(body.found).toBe(1)
    expect(mockUpsertBnpl).toHaveBeenCalledTimes(1)
  })

  it('upsert preserves dismissed status (no status in update for non-completed)', async () => {
    mockFindManyTransactions.mockResolvedValue([
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-01') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-15') })
    ])

    await app.inject({
      method: 'POST',
      url: '/bnpl/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    const upsertCall = mockUpsertBnpl.mock.calls[0]?.[0] as { update: Record<string, unknown> }
    // For non-completed obligations, status should not be in the update payload
    expect(upsertCall?.update).not.toHaveProperty('status')
  })

  it('enriches response obligations with remainingAmount', async () => {
    mockFindManyTransactions.mockResolvedValue([
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-01') }),
      makeTxn({ merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000, transactionDate: new Date('2025-01-15') })
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/bnpl/scan',
      headers: { authorization: 'Bearer mock-token' }
    })

    const body = res.json<{ obligations: Array<{ remainingAmount: number; installmentAmount: number; totalInstallments: number; paidInstallments: number }> }>()
    const ob = body.obligations[0]!
    expect(ob.remainingAmount).toBe((ob.totalInstallments - ob.paidInstallments) * ob.installmentAmount)
  })
})

// ─── GET /bnpl ────────────────────────────────────────────────────────────────

describe('GET /bnpl', () => {
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
    mockFindManyBnpl.mockResolvedValue([makeObligation()])
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })
    const res = await app.inject({ method: 'GET', url: '/bnpl' })
    expect(res.statusCode).toBe(401)
  })

  it('returns obligations list with summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bnpl',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ obligations: unknown[]; summary: { totalDebtKopecks: number } }>()
    expect(body.obligations).toHaveLength(1)
    expect(body.summary).toHaveProperty('totalDebtKopecks')
    expect(body.summary).toHaveProperty('activeCount')
    expect(body.summary).toHaveProperty('overdueCount')
  })

  it('passes status filter to prisma', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bnpl?status=active',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    expect(mockFindManyBnpl).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER_ID, status: 'active' }
      })
    )
  })

  it('returns 400 for invalid status query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bnpl?status=unknown',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(400)
  })

  it('computes totalDebtKopecks correctly', async () => {
    const ob = makeObligation({ totalInstallments: 4, paidInstallments: 2, installmentAmount: 250000, status: 'active' })
    mockFindManyBnpl.mockResolvedValue([ob])

    const res = await app.inject({
      method: 'GET',
      url: '/bnpl',
      headers: { authorization: 'Bearer mock-token' }
    })

    const body = res.json<{ summary: { totalDebtKopecks: number } }>()
    // 2 remaining * 250000 = 500000
    expect(body.summary.totalDebtKopecks).toBe(500000)
  })
})

// ─── PATCH /bnpl/:id ─────────────────────────────────────────────────────────

describe('PATCH /bnpl/:id', () => {
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
    mockFindFirstBnpl.mockResolvedValue(makeObligation())
    mockUpdateBnpl.mockResolvedValue(makeObligation({ status: 'dismissed' }))
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })
    const res = await app.inject({
      method: 'PATCH',
      url: '/bnpl/ob-1',
      payload: { status: 'dismissed' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('dismisses obligation successfully', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/bnpl/ob-1',
      headers: { authorization: 'Bearer mock-token' },
      payload: { status: 'dismissed' }
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdateBnpl).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'dismissed' } })
    )
  })

  it('returns 404 when obligation not found (IDOR protection)', async () => {
    mockFindFirstBnpl.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: '/bnpl/other-user-ob',
      headers: { authorization: 'Bearer mock-token' },
      payload: { status: 'dismissed' }
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/bnpl/ob-1',
      headers: { authorization: 'Bearer mock-token' },
      payload: { status: 'completed' } // completed not allowed via PATCH
    })

    expect(res.statusCode).toBe(400)
  })
})

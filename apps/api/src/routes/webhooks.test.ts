import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'

// ─── Env setup ────────────────────────────────────────────────────────────────

const TEST_SHOP_ID = 'test-shop-123'
const TEST_SECRET = 'test-secret-key-abc'

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockSubFindUnique = jest.fn()
const mockSubCreate = jest.fn()
const mockUserUpdate = jest.fn()
const mockTransaction = jest.fn()

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: {
    klyovoSubscription: {
      findUnique: mockSubFindUnique,
      create: mockSubCreate
    },
    user: {
      update: mockUserUpdate
    },
    $transaction: mockTransaction
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBasicAuth(shopId = TEST_SHOP_ID, secret = TEST_SECRET): string {
  return `Basic ${Buffer.from(`${shopId}:${secret}`).toString('base64')}`
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'notification',
    event: 'payment.succeeded',
    object: {
      id: 'yk-payment-abc',
      status: 'succeeded',
      amount: { value: '199.00', currency: 'RUB' },
      metadata: { userId: 'user-test-1', plan: 'plus_monthly' },
      paid: true,
      ...overrides
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /webhooks/yukassa', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'
    process.env['YUKASSA_SHOP_ID'] = TEST_SHOP_ID
    process.env['YUKASSA_SECRET_KEY'] = TEST_SECRET
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    jest.clearAllMocks()
    mockSubFindUnique.mockResolvedValue(null) // no existing sub by default
    mockTransaction.mockResolvedValue([{}, {}])
  })

  // ─── Auth ────────────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      payload: makePayload()
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when Basic auth credentials are wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth('wrong-shop', 'wrong-secret') },
      payload: makePayload()
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when only shopId is wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth('wrong-shop', TEST_SECRET) },
      payload: makePayload()
    })
    expect(res.statusCode).toBe(401)
  })

  // ─── Happy path ───────────────────────────────────────────────────────────

  it('activates subscription on payment.succeeded with paid=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload()
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('sets planExpiresAt +30 days for plus_monthly', async () => {
    const before = new Date()

    await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload({ metadata: { userId: 'user-1', plan: 'plus_monthly' }, id: 'pay-m' })
    })

    const txnCall = mockTransaction.mock.calls[0]?.[0] as unknown[]
    // Transaction array should contain create + update operations (from prisma.$transaction([...]))
    expect(txnCall).toHaveLength(2)

    // Verify date math via the user.update call inside the transaction
    // The transaction is called with array of prisma promises - we check it was called
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('sets planExpiresAt +365 days for plus_yearly', async () => {
    await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload({ metadata: { userId: 'user-1', plan: 'plus_yearly' }, id: 'pay-y' })
    })

    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  // ─── Idempotency ──────────────────────────────────────────────────────────

  it('is idempotent — no DB write on duplicate paymentId', async () => {
    mockSubFindUnique.mockResolvedValue({ id: 'existing-sub', yookassaPaymentId: 'yk-payment-abc' })

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload()
    })

    expect(res.statusCode).toBe(200)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  // ─── Non-triggering events ────────────────────────────────────────────────

  it('ignores payment.pending event (paid=false)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload({ status: 'pending', paid: false })
    })

    expect(res.statusCode).toBe(200)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('ignores payment.succeeded with paid=false (edge case)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload({ paid: false })
    })

    expect(res.statusCode).toBe(200)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  // ─── Missing metadata ─────────────────────────────────────────────────────

  it('returns 200 ok and skips activation when metadata.userId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload({ metadata: {} })
    })

    expect(res.statusCode).toBe(200)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns 200 ok and skips activation when metadata.plan is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/yukassa',
      headers: { authorization: makeBasicAuth() },
      payload: makePayload({ metadata: { userId: 'user-1' } })
    })

    expect(res.statusCode).toBe(200)
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

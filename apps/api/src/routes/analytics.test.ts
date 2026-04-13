import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import type { FastifyInstance } from 'fastify'

const TEST_USER_ID = 'analytics-route-test-user'
const TEST_JWT_PAYLOAD = { userId: TEST_USER_ID, telegramId: '999', plan: 'FREE' }

const mockComputeSummary = jest.fn()

jest.unstable_mockModule('../services/AnalyticsService.js', () => ({
  AnalyticsService: {
    computeSummary: mockComputeSummary,
    invalidateCache: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.unstable_mockModule('@klyovo/db', () => ({ prisma: {} }))
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

const mockSummary = {
  period: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
  totalKopecks: 124700,
  previousTotalKopecks: 98300,
  changePercent: 26.9,
  topCategories: [
    { category: 'FOOD_CAFE', totalKopecks: 45200, percentage: 36.2, transactionCount: 12 }
  ],
  transactionCount: 47
}

describe('GET /analytics/summary', () => {
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
    mockComputeSummary.mockResolvedValue(mockSummary)
  })

  it('returns 401 when requireAuth rejects', async () => {
    mockRequireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Требуется авторизация'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })
    const res = await app.inject({ method: 'GET', url: '/analytics/summary' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with valid JWT and default period', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/summary',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<typeof mockSummary>()
    expect(body.totalKopecks).toBe(124700)
    expect(body.topCategories).toHaveLength(1)
    expect(mockComputeSummary).toHaveBeenCalledWith(TEST_USER_ID, 'month')
  })

  it('passes period param to service', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/summary?period=last_month',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    expect(mockComputeSummary).toHaveBeenCalledWith(TEST_USER_ID, 'last_month')
  })

  it('passes 3months period to service', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/summary?period=3months',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(200)
    expect(mockComputeSummary).toHaveBeenCalledWith(TEST_USER_ID, '3months')
  })

  it('returns 400 for invalid period value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/summary?period=yearly',
      headers: { authorization: 'Bearer mock-token' }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

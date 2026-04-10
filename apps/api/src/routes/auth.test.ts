import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'

const BOT_TOKEN = 'test_bot_token_integration'

const mockUser = {
  id: 'user-uuid-123',
  telegramId: 123456789n,
  telegramUsername: 'testuser',
  displayName: 'Тест User',
  plan: 'FREE',
  planExpiresAt: null,
  referralCode: 'TESTREF1',
  referredBy: null,
  consentGivenAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockPrisma = {
  user: {
    upsert: jest.fn().mockResolvedValue(mockUser),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(mockUser)
  }
}

// ESM-compatible mocks — must be called before dynamic imports below
jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: mockPrisma
}))

// Prevent Redis connection in tests
jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => null,
  default: async (_app: unknown) => {}
}))

function buildValidInitData(userId = 123456789, firstName = 'Тест', authDateOffset = -60): string {
  const authDate = Math.floor(Date.now() / 1000) + authDateOffset
  const params: Record<string, string> = {
    auth_date: String(authDate),
    user: JSON.stringify({ id: userId, first_name: firstName, username: 'testuser' })
  }

  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  params['hash'] = hash

  return new URLSearchParams(params).toString()
}

describe('POST /auth/telegram', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['TELEGRAM_BOT_TOKEN'] = BOT_TOKEN
    process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_chars_long_abc'

    // Dynamic import AFTER unstable_mockModule so the mock is in place
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['TELEGRAM_BOT_TOKEN']
    delete process.env['JWT_SECRET']
  })

  beforeEach(() => {
    mockPrisma.user.upsert.mockResolvedValue(mockUser)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue(mockUser)
  })

  it('returns 200 with JWT token for valid initData', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: buildValidInitData() }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ token: string; user: { id: string; plan: string } }>()
    expect(body.token).toBeDefined()
    expect(typeof body.token).toBe('string')
    expect(body.user.plan).toBe('FREE')
    expect(body.user.id).toBe('user-uuid-123')
  })

  it('returns 401 for tampered hash (INVALID_INIT_DATA)', async () => {
    const authDate = Math.floor(Date.now() / 1000) - 60
    const params = new URLSearchParams({
      auth_date: String(authDate),
      user: JSON.stringify({ id: 1, first_name: 'Fake' }),
      hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    })

    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: params.toString() }
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('INVALID_INIT_DATA')
  })

  it('returns 401 for expired initData (EXPIRED_INIT_DATA)', async () => {
    // auth_date 25 hours ago
    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: buildValidInitData(1, 'Old', -90000) }
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('EXPIRED_INIT_DATA')
  })

  it('returns 400 for missing initData field', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: {}
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 for empty string initData', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/telegram',
      payload: { initData: '' }
    })

    expect(response.statusCode).toBe(400)
  })
})

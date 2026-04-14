import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import type { FastifyInstance } from 'fastify'

const TEST_USER_ID = 'test-user-uuid'

const mockStreakData = {
  importStreak: { current: 7, longest: 14, lastActiveDate: '2026-04-14' },
  spendingStreak: { current: 2, longest: 5, lastComputedWeek: '2026-W15' }
}

const mockAchievementsData = {
  unlocked: [
    { type: 'FIRST_IMPORT', emoji: '📂', name: 'Первый шаг', description: 'Первый CSV-импорт', unlockedAt: new Date().toISOString() }
  ],
  locked: [
    { type: 'WEEK_STREAK', emoji: '🔥', name: 'Неделя не сломался', description: 'Стрик 7 дней' }
  ]
}

const mockStreakService = {
  getStreaks: jest.fn().mockResolvedValue(mockStreakData)
}

const mockAchievementService = {
  getAchievements: jest.fn().mockResolvedValue(mockAchievementsData),
  isUnlocked: jest.fn().mockResolvedValue(true),
  getShareText: jest.fn().mockReturnValue('📂 Первый шаг — Клёво! 🔥 @KlyovoBot'),
  checkAndUnlock: jest.fn().mockResolvedValue([])
}

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: {}
}))

jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => ({ get: async () => null, set: async () => 'OK', del: async () => 1 }),
  default: async () => {}
}))

jest.unstable_mockModule('../plugins/jwt.js', () => ({
  JWT_TTL_SECONDS: 604800,
  requireAuth: jest.fn().mockImplementation(async (req: Record<string, unknown>) => {
    req['user'] = { userId: TEST_USER_ID }
  }),
  default: async () => {}
}))

jest.unstable_mockModule('../services/StreakService.js', () => ({
  StreakService: mockStreakService
}))

jest.unstable_mockModule('../services/AchievementService.js', () => ({
  AchievementService: mockAchievementService
}))

describe('GET /streaks', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })
  beforeEach(() => jest.clearAllMocks())

  it('returns streak data for authenticated user', async () => {
    const res = await app.inject({ method: 'GET', url: '/streaks' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.importStreak.current).toBe(7)
    expect(body.spendingStreak.current).toBe(2)
  })

  it('calls StreakService.getStreaks with userId from JWT', async () => {
    await app.inject({ method: 'GET', url: '/streaks' })

    expect(mockStreakService.getStreaks).toHaveBeenCalledWith(TEST_USER_ID)
  })

  it('returns 401 without auth token', async () => {
    const { requireAuth } = await import('../plugins/jwt.js') as { requireAuth: jest.MockedFunction<() => Promise<void>> }
    requireAuth.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Требуется авторизация'), { statusCode: 401, code: 'UNAUTHORIZED' })
    })

    const res = await app.inject({ method: 'GET', url: '/streaks' })

    expect(res.statusCode).toBe(401)
  })
})

describe('GET /achievements', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })
  beforeEach(() => jest.clearAllMocks())

  it('returns unlocked and locked achievements', async () => {
    const res = await app.inject({ method: 'GET', url: '/achievements' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.unlocked).toHaveLength(1)
    expect(body.locked).toHaveLength(1)
    expect(body.unlocked[0].type).toBe('FIRST_IMPORT')
  })

  it('calls AchievementService.getAchievements with userId', async () => {
    await app.inject({ method: 'GET', url: '/achievements' })

    expect(mockAchievementService.getAchievements).toHaveBeenCalledWith(TEST_USER_ID)
  })
})

describe('POST /streaks/share', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const { buildApp } = await import('../index.js')
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => { await app.close() })
  beforeEach(() => jest.clearAllMocks())

  it('returns share text for unlocked achievement', async () => {
    mockAchievementService.isUnlocked.mockResolvedValue(true)

    const res = await app.inject({
      method: 'POST',
      url: '/streaks/share',
      payload: { achievementType: 'FIRST_IMPORT' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.shareText).toContain('📂')
  })

  it('returns 400 for locked achievement', async () => {
    mockAchievementService.isUnlocked.mockResolvedValue(false)

    const res = await app.inject({
      method: 'POST',
      url: '/streaks/share',
      payload: { achievementType: 'MONTH_STREAK' }
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('ACHIEVEMENT_NOT_UNLOCKED')
  })

  it('returns 400 for invalid achievementType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/streaks/share',
      payload: { achievementType: 'INVALID_TYPE' }
    })

    expect(res.statusCode).toBe(400)
  })

  it('records SOCIAL_SHARER achievement on share', async () => {
    mockAchievementService.isUnlocked.mockResolvedValue(true)
    mockAchievementService.checkAndUnlock.mockResolvedValue(['SOCIAL_SHARER'])

    const res = await app.inject({
      method: 'POST',
      url: '/streaks/share',
      payload: { achievementType: 'FIRST_IMPORT' }
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().newlyUnlocked).toContain('SOCIAL_SHARER')
  })
})

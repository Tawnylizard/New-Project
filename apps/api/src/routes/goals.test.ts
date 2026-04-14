import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'
import type { FastifyInstance } from 'fastify'

const TEST_USER_ID = 'test-user-uuid'
const TEST_GOAL_ID = 'test-goal-uuid'

const mockGoal = {
  id: TEST_GOAL_ID,
  userId: TEST_USER_ID,
  name: 'Отпуск в Турции',
  category: 'VACATION',
  targetAmountKopecks: 5000000,
  currentAmountKopecks: 1000000,
  deadline: null,
  status: 'ACTIVE',
  aiAdvice: null,
  aiAdviceGeneratedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockGoalService = {
  create: jest.fn().mockResolvedValue(mockGoal),
  list: jest.fn().mockResolvedValue([mockGoal]),
  update: jest.fn().mockResolvedValue(mockGoal),
  delete: jest.fn().mockResolvedValue(undefined),
  generateAdvice: jest.fn().mockResolvedValue({
    advice: 'Сократи траты на маркетплейсы. Это информационный сервис.',
    generatedAt: new Date().toISOString()
  })
}

const mockUser = { id: TEST_USER_ID, plan: 'FREE' }
const mockUserPlus = { id: TEST_USER_ID, plan: 'PLUS' }

const mockPrisma = {
  user: {
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockUser)
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
    req['user'] = { userId: TEST_USER_ID, plan: 'FREE' }
  }),
  JWT_TTL_SECONDS: 604800
}))
jest.unstable_mockModule('../services/GoalService.js', () => ({
  GoalService: mockGoalService
}))

describe('Goals API', () => {
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
    mockGoalService.create.mockResolvedValue(mockGoal)
    mockGoalService.list.mockResolvedValue([mockGoal])
    mockGoalService.update.mockResolvedValue(mockGoal)
    mockGoalService.delete.mockResolvedValue(undefined)
    mockGoalService.generateAdvice.mockResolvedValue({
      advice: 'Сократи траты. Это информационный сервис.',
      generatedAt: new Date().toISOString()
    })
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser)
  })

  describe('POST /goals', () => {
    it('creates a goal with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/goals',
        payload: {
          name: 'Отпуск',
          category: 'VACATION',
          targetAmountKopecks: 5000000
        }
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body) as { data: typeof mockGoal }
      expect(body.data.id).toBe(TEST_GOAL_ID)
    })

    it('returns 400 when category is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/goals',
        payload: {
          name: 'Цель',
          category: 'INVALID_CATEGORY',
          targetAmountKopecks: 100000
        }
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when targetAmountKopecks is zero', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/goals',
        payload: {
          name: 'Цель',
          category: 'SAVINGS',
          targetAmountKopecks: 0
        }
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when deadline is in the past', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/goals',
        payload: {
          name: 'Цель',
          category: 'SAVINGS',
          targetAmountKopecks: 100000,
          deadline: '2020-01-01T00:00:00.000Z'
        }
      })

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body) as { error: { code: string } }
      expect(body.error.code).toBe('INVALID_DEADLINE')
    })

    it('returns 403 when FREE user hits limit', async () => {
      const limitError = Object.assign(new Error('FREE limit'), { statusCode: 403, code: 'GOAL_LIMIT_REACHED' })
      mockGoalService.create.mockRejectedValue(limitError)

      const res = await app.inject({
        method: 'POST',
        url: '/goals',
        payload: {
          name: 'Вторая цель',
          category: 'SAVINGS',
          targetAmountKopecks: 100000
        }
      })

      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body) as { error: { code: string } }
      expect(body.error.code).toBe('GOAL_LIMIT_REACHED')
    })
  })

  describe('GET /goals', () => {
    it('returns list of goals', async () => {
      const res = await app.inject({ method: 'GET', url: '/goals' })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as { goals: typeof mockGoal[] }
      expect(body.goals).toHaveLength(1)
      expect(body.goals[0]?.id).toBe(TEST_GOAL_ID)
    })

    it('passes status filter to GoalService', async () => {
      await app.inject({ method: 'GET', url: '/goals?status=COMPLETED' })

      expect(mockGoalService.list).toHaveBeenCalledWith(TEST_USER_ID, 'COMPLETED')
    })
  })

  describe('PUT /goals/:id', () => {
    it('updates goal progress', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/goals/${TEST_GOAL_ID}`,
        payload: { currentAmountKopecks: 2000000 }
      })

      expect(res.statusCode).toBe(200)
    })

    it('returns 404 when goal not found', async () => {
      const notFoundError = Object.assign(new Error('Not found'), { statusCode: 404, code: 'GOAL_NOT_FOUND' })
      mockGoalService.update.mockRejectedValue(notFoundError)

      const res = await app.inject({
        method: 'PUT',
        url: `/goals/non-existent`,
        payload: { currentAmountKopecks: 1000 }
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /goals/:id', () => {
    it('deletes a goal', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/goals/${TEST_GOAL_ID}`
      })

      expect(res.statusCode).toBe(204)
    })

    it('returns 404 when goal not found', async () => {
      const notFoundError = Object.assign(new Error('Not found'), { statusCode: 404, code: 'GOAL_NOT_FOUND' })
      mockGoalService.delete.mockRejectedValue(notFoundError)

      const res = await app.inject({
        method: 'DELETE',
        url: `/goals/non-existent`
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /goals/:id/advice', () => {
    it('returns 403 for FREE user', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser) // plan: FREE

      const res = await app.inject({
        method: 'POST',
        url: `/goals/${TEST_GOAL_ID}/advice`
      })

      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body) as { error: { code: string } }
      expect(body.error.code).toBe('PLAN_REQUIRED')
    })

    it('returns advice for PLUS user', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUserPlus) // plan: PLUS

      const res = await app.inject({
        method: 'POST',
        url: `/goals/${TEST_GOAL_ID}/advice`
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as { advice: string }
      expect(body.advice).toContain('информационный сервис')
    })

    it('returns 404 for non-existent goal', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUserPlus)
      const notFoundError = Object.assign(new Error('Not found'), { statusCode: 404, code: 'GOAL_NOT_FOUND' })
      mockGoalService.generateAdvice.mockRejectedValue(notFoundError)

      const res = await app.inject({
        method: 'POST',
        url: `/goals/non-existent/advice`
      })

      expect(res.statusCode).toBe(404)
    })
  })
})

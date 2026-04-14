import { jest, describe, it, beforeEach, expect } from '@jest/globals'

// Mock Redis
const mockRedis = {
  get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  set: jest.fn<() => Promise<string>>().mockResolvedValue('OK')
}

jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => mockRedis,
  default: async () => {}
}))

// Mock Prisma
const mockGoal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Отпуск',
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

const mockPrisma = {
  financialGoal: {
    create: jest.fn<() => Promise<typeof mockGoal>>().mockResolvedValue(mockGoal),
    findFirst: jest.fn<() => Promise<typeof mockGoal | null>>().mockResolvedValue(mockGoal),
    findMany: jest.fn<() => Promise<typeof mockGoal[]>>().mockResolvedValue([mockGoal]),
    update: jest.fn<() => Promise<typeof mockGoal>>().mockResolvedValue(mockGoal),
    delete: jest.fn<() => Promise<typeof mockGoal>>().mockResolvedValue(mockGoal),
    count: jest.fn<() => Promise<number>>().mockResolvedValue(0)
  },
  transaction: {
    findMany: jest.fn<() => Promise<Array<{ amountKopecks: number; category: string }>>>().mockResolvedValue([
      { amountKopecks: 200000, category: 'FOOD_CAFE' },
      { amountKopecks: 150000, category: 'MARKETPLACE' }
    ])
  }
}

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: mockPrisma
}))

describe('GoalService', () => {
  let GoalService: Awaited<ReturnType<typeof import('./GoalService.js')>>['GoalService']

  beforeEach(async () => {
    jest.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.financialGoal.count.mockResolvedValue(0)
    mockPrisma.financialGoal.findFirst.mockResolvedValue(mockGoal)
    mockPrisma.financialGoal.create.mockResolvedValue(mockGoal)
    mockPrisma.financialGoal.update.mockResolvedValue(mockGoal)
    process.env['YANDEX_GPT_API_KEY'] = 'test-key'
    process.env['YANDEX_GPT_FOLDER_ID'] = 'test-folder'
    process.env['GIGACHAT_API_KEY'] = 'gigachat-key'
    const mod = await import('./GoalService.js')
    GoalService = mod.GoalService
  })

  describe('create', () => {
    it('creates goal for PLUS user without limit check', async () => {
      await GoalService.create({
        userId: 'user-1',
        name: 'Отпуск',
        category: 'VACATION',
        targetAmountKopecks: 5000000,
        currentAmountKopecks: 0,
        deadline: null,
        isPlusPlan: true
      })
      expect(mockPrisma.financialGoal.count).not.toHaveBeenCalled()
      expect(mockPrisma.financialGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
      )
    })

    it('enforces 1-goal limit for FREE user', async () => {
      mockPrisma.financialGoal.count.mockResolvedValue(1)

      await expect(
        GoalService.create({
          userId: 'user-1',
          name: 'Вторая цель',
          category: 'SAVINGS',
          targetAmountKopecks: 100000,
          currentAmountKopecks: 0,
          deadline: null,
          isPlusPlan: false
        })
      ).rejects.toMatchObject({ code: 'GOAL_LIMIT_REACHED', statusCode: 403 })
    })

    it('allows FREE user to create first goal', async () => {
      mockPrisma.financialGoal.count.mockResolvedValue(0)

      await GoalService.create({
        userId: 'user-1',
        name: 'Первая цель',
        category: 'SAVINGS',
        targetAmountKopecks: 100000,
        currentAmountKopecks: 0,
        deadline: null,
        isPlusPlan: false
      })
      expect(mockPrisma.financialGoal.create).toHaveBeenCalled()
    })

    it('sets status to COMPLETED if currentAmount >= targetAmount at creation', async () => {
      const completedGoal = { ...mockGoal, status: 'COMPLETED' }
      mockPrisma.financialGoal.create.mockResolvedValue(completedGoal)

      await GoalService.create({
        userId: 'user-1',
        name: 'Уже накоплено',
        category: 'SAVINGS',
        targetAmountKopecks: 100000,
        currentAmountKopecks: 100000,
        deadline: null,
        isPlusPlan: true
      })

      expect(mockPrisma.financialGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' })
        })
      )
    })
  })

  describe('update', () => {
    it('auto-completes goal when currentAmount reaches target', async () => {
      const activeGoal = { ...mockGoal, status: 'ACTIVE', targetAmountKopecks: 5000000 }
      mockPrisma.financialGoal.findFirst.mockResolvedValue(activeGoal)

      await GoalService.update({
        userId: 'user-1',
        goalId: 'goal-1',
        currentAmountKopecks: 5000000
      })

      expect(mockPrisma.financialGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED', currentAmountKopecks: 5000000 })
        })
      )
    })

    it('throws GOAL_NOT_FOUND when goal belongs to another user', async () => {
      mockPrisma.financialGoal.findFirst.mockResolvedValue(null)

      await expect(
        GoalService.update({ userId: 'other-user', goalId: 'goal-1' })
      ).rejects.toMatchObject({ code: 'GOAL_NOT_FOUND', statusCode: 404 })
    })

    it('throws GOAL_ARCHIVED when trying to update abandoned goal', async () => {
      const abandonedGoal = { ...mockGoal, status: 'ABANDONED' }
      mockPrisma.financialGoal.findFirst.mockResolvedValue(abandonedGoal)

      await expect(
        GoalService.update({ userId: 'user-1', goalId: 'goal-1', currentAmountKopecks: 1000 })
      ).rejects.toMatchObject({ code: 'GOAL_ARCHIVED', statusCode: 400 })
    })
  })

  describe('delete', () => {
    it('throws GOAL_NOT_FOUND for non-existent goal', async () => {
      mockPrisma.financialGoal.findFirst.mockResolvedValue(null)

      await expect(
        GoalService.delete('user-1', 'non-existent')
      ).rejects.toMatchObject({ code: 'GOAL_NOT_FOUND', statusCode: 404 })
    })

    it('deletes goal when it exists', async () => {
      mockPrisma.financialGoal.findFirst.mockResolvedValue(mockGoal)

      await GoalService.delete('user-1', 'goal-1')

      expect(mockPrisma.financialGoal.delete).toHaveBeenCalledWith({ where: { id: 'goal-1' } })
    })
  })

  describe('generateAdvice', () => {
    it('returns cached advice when available in Redis', async () => {
      const cachedPayload = JSON.stringify({ advice: 'Кэшированный совет', generatedAt: new Date().toISOString() })
      mockRedis.get.mockResolvedValue(cachedPayload)
      const fetchSpy = jest.spyOn(global, 'fetch')

      const result = await GoalService.generateAdvice('user-1', 'goal-1')

      expect(result.advice).toBe('Кэшированный совет')
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('throws GOAL_NOT_FOUND for non-active goal', async () => {
      mockPrisma.financialGoal.findFirst.mockResolvedValue(null)

      await expect(
        GoalService.generateAdvice('user-1', 'goal-1')
      ).rejects.toMatchObject({ code: 'GOAL_NOT_FOUND', statusCode: 404 })
    })

    it('uses YandexGPT when available', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            alternatives: [{
              message: { text: 'Сократи траты на маркетплейсы на ₽2000 в месяц. Это даст тебе нужную сумму за 3 месяца раньше запланированного.' }
            }]
          }
        })
      } as unknown as Response)

      const result = await GoalService.generateAdvice('user-1', 'goal-1')

      expect(result.advice).toContain('₽2000')
      expect(result.advice).toContain('информационный сервис')
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('falls back to GigaChat when YandexGPT fails', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('YandexGPT timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'GigaChat совет: урежь кофе. Это даст ₽3000 в месяц, хватит за 6 месяцев.' } }]
          })
        } as unknown as Response)

      const result = await GoalService.generateAdvice('user-1', 'goal-1')

      expect(result.advice).toContain('GigaChat совет')
      expect(result.advice).toContain('информационный сервис')
    })

    it('uses cached fallback when both LLMs fail', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network error'))

      const result = await GoalService.generateAdvice('user-1', 'goal-1')

      expect(result.advice.length).toBeGreaterThan(50)
      expect(result.advice).toContain('информационный сервис')
    })

    it('always appends disclaimer to advice', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            alternatives: [{ message: { text: 'Хороший совет без дисклеймера.' } }]
          }
        })
      } as unknown as Response)

      const result = await GoalService.generateAdvice('user-1', 'goal-1')

      expect(result.advice).toContain('информационный сервис')
    })
  })
})

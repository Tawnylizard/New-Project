import { jest, describe, it, beforeEach, expect } from '@jest/globals'

const TEST_USER_ID = 'user-analytics-test'

// Mock Prisma
const mockGroupBy = jest.fn()
const mockAggregate = jest.fn()

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: {
    transaction: {
      groupBy: mockGroupBy,
      aggregate: mockAggregate
    }
  }
}))

// Mock Redis (rateLimit plugin)
const mockRedisGet = jest.fn()
const mockRedisSetex = jest.fn()
const mockRedisKeys = jest.fn()
const mockRedisDel = jest.fn()

jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  getRedisClient: () => ({
    get: mockRedisGet,
    setex: mockRedisSetex,
    keys: mockRedisKeys,
    del: mockRedisDel
  })
}))

describe('AnalyticsService', () => {
  let AnalyticsService: Awaited<typeof import('./AnalyticsService.js')>['AnalyticsService']

  beforeEach(async () => {
    jest.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockRedisSetex.mockResolvedValue('OK')
    mockRedisKeys.mockResolvedValue([])
    mockRedisDel.mockResolvedValue(1)
    const mod = await import('./AnalyticsService.js')
    AnalyticsService = mod.AnalyticsService
  })

  describe('computeSummary', () => {
    it('returns correct aggregation for "month" period', async () => {
      mockGroupBy.mockResolvedValue([
        { category: 'FOOD_CAFE', _sum: { amountKopecks: 50000 }, _count: { id: 5 } },
        { category: 'TRANSPORT', _sum: { amountKopecks: 20000 }, _count: { id: 3 } }
      ])
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: 60000 } })

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.totalKopecks).toBe(70000)
      expect(result.previousTotalKopecks).toBe(60000)
      expect(result.changePercent).toBeCloseTo(16.7, 0)
      expect(result.topCategories).toHaveLength(2)
      expect(result.topCategories[0]?.category).toBe('FOOD_CAFE')
      expect(result.topCategories[0]?.totalKopecks).toBe(50000)
      expect(result.transactionCount).toBe(8)
    })

    it('returns changePercent = null when no previous data', async () => {
      mockGroupBy.mockResolvedValue([
        { category: 'GROCERIES', _sum: { amountKopecks: 30000 }, _count: { id: 2 } }
      ])
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: null } })

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.changePercent).toBeNull()
      expect(result.previousTotalKopecks).toBe(0)
    })

    it('returns zeros when no transactions in period', async () => {
      mockGroupBy.mockResolvedValue([])
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: null } })

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.totalKopecks).toBe(0)
      expect(result.topCategories).toHaveLength(0)
      expect(result.transactionCount).toBe(0)
      expect(result.changePercent).toBeNull()
    })

    it('uses cached result when cache hit', async () => {
      const cachedData = { totalKopecks: 99999, topCategories: [], transactionCount: 0, changePercent: null, previousTotalKopecks: 0, period: { from: '', to: '' } }
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData))

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.totalKopecks).toBe(99999)
      expect(mockGroupBy).not.toHaveBeenCalled()
    })

    it('handles null _sum.amountKopecks per category (null-guard)', async () => {
      mockGroupBy.mockResolvedValue([
        { category: 'OTHER', _sum: { amountKopecks: null }, _count: { id: 1 } }
      ])
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: null } })

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.totalKopecks).toBe(0)
      expect(result.topCategories[0]?.totalKopecks).toBe(0)
    })

    it('sorts topCategories by amount descending', async () => {
      mockGroupBy.mockResolvedValue([
        { category: 'TRANSPORT', _sum: { amountKopecks: 10000 }, _count: { id: 1 } },
        { category: 'FOOD_CAFE', _sum: { amountKopecks: 50000 }, _count: { id: 5 } },
        { category: 'GROCERIES', _sum: { amountKopecks: 30000 }, _count: { id: 3 } }
      ])
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: null } })

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.topCategories[0]?.category).toBe('FOOD_CAFE')
      expect(result.topCategories[1]?.category).toBe('GROCERIES')
      expect(result.topCategories[2]?.category).toBe('TRANSPORT')
    })

    it('limits topCategories to 5', async () => {
      mockGroupBy.mockResolvedValue(
        ['FOOD_CAFE', 'GROCERIES', 'MARKETPLACE', 'TRANSPORT', 'SUBSCRIPTIONS', 'ENTERTAINMENT', 'HEALTH'].map(
          (category, i) => ({
            category,
            _sum: { amountKopecks: (7 - i) * 10000 },
            _count: { id: 1 }
          })
        )
      )
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: null } })

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.topCategories).toHaveLength(5)
    })

    it('computes category percentages correctly', async () => {
      mockGroupBy.mockResolvedValue([
        { category: 'FOOD_CAFE', _sum: { amountKopecks: 75000 }, _count: { id: 5 } },
        { category: 'TRANSPORT', _sum: { amountKopecks: 25000 }, _count: { id: 2 } }
      ])
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: null } })

      const result = await AnalyticsService.computeSummary(TEST_USER_ID, 'month')

      expect(result.topCategories[0]?.percentage).toBe(75)
      expect(result.topCategories[1]?.percentage).toBe(25)
    })

    it('skips Redis and proceeds when Redis is unavailable', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis connection refused'))
      mockRedisSetex.mockRejectedValue(new Error('Redis connection refused'))
      mockGroupBy.mockResolvedValue([])
      mockAggregate.mockResolvedValue({ _sum: { amountKopecks: null } })

      await expect(AnalyticsService.computeSummary(TEST_USER_ID, 'month')).resolves.toBeDefined()
    })
  })

  describe('invalidateCache', () => {
    it('deletes all analytics keys for user', async () => {
      mockRedisKeys.mockResolvedValue([`analytics:${TEST_USER_ID}:month`, `analytics:${TEST_USER_ID}:last_month`])

      await AnalyticsService.invalidateCache(TEST_USER_ID)

      expect(mockRedisDel).toHaveBeenCalledWith(`analytics:${TEST_USER_ID}:month`, `analytics:${TEST_USER_ID}:last_month`)
    })

    it('does nothing when no keys exist', async () => {
      mockRedisKeys.mockResolvedValue([])

      await AnalyticsService.invalidateCache(TEST_USER_ID)

      expect(mockRedisDel).not.toHaveBeenCalled()
    })

    it('silently handles Redis unavailability', async () => {
      mockRedisKeys.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(AnalyticsService.invalidateCache(TEST_USER_ID)).resolves.toBeUndefined()
    })
  })
})

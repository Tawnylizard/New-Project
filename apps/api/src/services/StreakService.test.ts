import { jest, describe, it, beforeEach, expect } from '@jest/globals'

// Mock Redis
const mockRedis = {
  get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  set: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
  del: jest.fn<() => Promise<number>>().mockResolvedValue(1)
}

jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => mockRedis,
  default: async () => {}
}))

// Mock Prisma
const mockUserStreak = {
  id: 'streak-1',
  userId: 'user-1',
  importStreak: 0,
  importStreakLongest: 0,
  importLastDate: null as Date | null,
  spendingStreak: 0,
  spendingStreakLongest: 0,
  spendingLastWeek: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockPrisma = {
  userStreak: {
    findUnique: jest.fn<() => Promise<typeof mockUserStreak | null>>().mockResolvedValue(mockUserStreak),
    upsert: jest.fn<() => Promise<typeof mockUserStreak>>().mockResolvedValue(mockUserStreak),
    update: jest.fn<() => Promise<typeof mockUserStreak>>().mockResolvedValue(mockUserStreak)
  },
  transaction: {
    aggregate: jest.fn<() => Promise<{ _sum: { amountKopecks: number | null } }>>().mockResolvedValue({ _sum: { amountKopecks: 0 } })
  }
}

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: mockPrisma
}))

describe('StreakService.updateImportStreak', () => {
  let StreakService: Awaited<ReturnType<typeof import('./StreakService.js')>>['StreakService']
  const userId = 'user-1'

  beforeEach(async () => {
    jest.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.del.mockResolvedValue(1)
    ;({ StreakService } = await import('./StreakService.js'))
  })

  it('starts streak at 1 on first import (no last date)', async () => {
    const base = { ...mockUserStreak, importLastDate: null }
    mockPrisma.userStreak.upsert.mockResolvedValue(base as never)
    mockPrisma.userStreak.update.mockResolvedValue({ ...base, importStreak: 1, importStreakLongest: 1 } as never)

    const result = await StreakService.updateImportStreak(userId)

    expect(result.newStreak).toBe(1)
    expect(result.wasReset).toBe(false)
  })

  it('extends streak on consecutive day (diff=1)', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const base = { ...mockUserStreak, importStreak: 5, importStreakLongest: 10, importLastDate: yesterday }
    mockPrisma.userStreak.upsert.mockResolvedValue(base as never)
    mockPrisma.userStreak.update.mockResolvedValue({ ...base, importStreak: 6, importStreakLongest: 10 } as never)

    const result = await StreakService.updateImportStreak(userId)

    expect(result.newStreak).toBe(6)
    expect(result.wasReset).toBe(false)
  })

  it('extends streak on grace period day (diff=2)', async () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const base = { ...mockUserStreak, importStreak: 5, importStreakLongest: 10, importLastDate: twoDaysAgo }
    mockPrisma.userStreak.upsert.mockResolvedValue(base as never)
    mockPrisma.userStreak.update.mockResolvedValue({ ...base, importStreak: 6, importStreakLongest: 10 } as never)

    const result = await StreakService.updateImportStreak(userId)

    expect(result.newStreak).toBe(6)
    expect(result.wasReset).toBe(false)
  })

  it('resets streak when diff >= 3', async () => {
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

    const base = { ...mockUserStreak, importStreak: 10, importStreakLongest: 14, importLastDate: fiveDaysAgo }
    mockPrisma.userStreak.upsert.mockResolvedValue(base as never)
    mockPrisma.userStreak.update.mockResolvedValue({ ...base, importStreak: 1, importStreakLongest: 14 } as never)

    const result = await StreakService.updateImportStreak(userId)

    expect(result.newStreak).toBe(1)
    expect(result.wasReset).toBe(true)
  })

  it('returns same streak when called same day (diff=0)', async () => {
    const today = new Date()

    const base = { ...mockUserStreak, importStreak: 7, importStreakLongest: 7, importLastDate: today }
    mockPrisma.userStreak.upsert.mockResolvedValue(base as never)

    const result = await StreakService.updateImportStreak(userId)

    expect(result.newStreak).toBe(7)
    expect(result.wasReset).toBe(false)
    expect(mockPrisma.userStreak.update).not.toHaveBeenCalled()
  })

  it('updates longest streak when new streak exceeds it', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const base = { ...mockUserStreak, importStreak: 14, importStreakLongest: 14, importLastDate: yesterday }
    mockPrisma.userStreak.upsert.mockResolvedValue(base as never)
    mockPrisma.userStreak.update.mockResolvedValue({ ...base, importStreak: 15, importStreakLongest: 15 } as never)

    const result = await StreakService.updateImportStreak(userId)

    expect(result.longestStreak).toBe(15)
    const updateCall = (mockPrisma.userStreak.update.mock.calls[0] as Array<{ data: { importStreakLongest?: number } }>)[0]
    expect(updateCall?.data?.importStreakLongest).toBe(15)
  })
})

describe('StreakService.getStreaks', () => {
  let StreakService: Awaited<ReturnType<typeof import('./StreakService.js')>>['StreakService']
  const userId = 'user-1'

  beforeEach(async () => {
    jest.clearAllMocks()
    ;({ StreakService } = await import('./StreakService.js'))
  })

  it('returns zeros when no streak exists', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockPrisma.userStreak.findUnique.mockResolvedValue(null)

    const result = await StreakService.getStreaks(userId)

    expect(result.importStreak.current).toBe(0)
    expect(result.importStreak.longest).toBe(0)
    expect(result.spendingStreak.current).toBe(0)
  })

  it('returns cached value when Redis has data', async () => {
    const cached = { importStreak: { current: 7, longest: 14 }, spendingStreak: { current: 3, longest: 5 } }
    mockRedis.get.mockResolvedValue(JSON.stringify(cached))

    const result = await StreakService.getStreaks(userId)

    expect(result.importStreak.current).toBe(7)
    expect(mockPrisma.userStreak.findUnique).not.toHaveBeenCalled()
  })

  it('falls back to DB when Redis throws', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis down') as never)

    const base = { ...mockUserStreak, importStreak: 5, importStreakLongest: 10, spendingStreak: 2, spendingStreakLongest: 4 }
    mockPrisma.userStreak.findUnique.mockResolvedValue(base as never)

    const result = await StreakService.getStreaks(userId)

    expect(result.importStreak.current).toBe(5)
    expect(result.spendingStreak.current).toBe(2)
  })
})

describe('StreakService.computeSpendingStreakForUser', () => {
  let StreakService: Awaited<ReturnType<typeof import('./StreakService.js')>>['StreakService']
  const userId = 'user-1'

  beforeEach(async () => {
    jest.clearAllMocks()
    mockRedis.del.mockResolvedValue(1)
    ;({ StreakService } = await import('./StreakService.js'))
  })

  it('freezes streak when no current week data', async () => {
    mockPrisma.userStreak.findUnique.mockResolvedValue({ ...mockUserStreak, spendingStreak: 3 } as never)
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amountKopecks: 0 } } as never)
      .mockResolvedValueOnce({ _sum: { amountKopecks: 5000 } } as never)

    await StreakService.computeSpendingStreakForUser(userId)

    expect(mockPrisma.userStreak.upsert).not.toHaveBeenCalled()
  })

  it('increments spending streak when current < previous', async () => {
    mockPrisma.userStreak.findUnique.mockResolvedValue({ ...mockUserStreak, spendingStreak: 2, spendingStreakLongest: 5, spendingLastWeek: null } as never)
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amountKopecks: 800000 } } as never)
      .mockResolvedValueOnce({ _sum: { amountKopecks: 1000000 } } as never)
    mockPrisma.userStreak.upsert.mockResolvedValue(mockUserStreak as never)

    await StreakService.computeSpendingStreakForUser(userId)

    const upsertCall = (mockPrisma.userStreak.upsert.mock.calls[0] as Array<{ update: { spendingStreak: number } }>)[0]
    expect(upsertCall?.update?.spendingStreak).toBe(3)
  })

  it('resets spending streak when current >= previous', async () => {
    mockPrisma.userStreak.findUnique.mockResolvedValue({ ...mockUserStreak, spendingStreak: 5, spendingStreakLongest: 5, spendingLastWeek: null } as never)
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amountKopecks: 1200000 } } as never)
      .mockResolvedValueOnce({ _sum: { amountKopecks: 1000000 } } as never)
    mockPrisma.userStreak.upsert.mockResolvedValue(mockUserStreak as never)

    await StreakService.computeSpendingStreakForUser(userId)

    const upsertCall = (mockPrisma.userStreak.upsert.mock.calls[0] as Array<{ update: { spendingStreak: number } }>)[0]
    expect(upsertCall?.update?.spendingStreak).toBe(0)
  })

  it('skips computation if already computed this week', async () => {
    const now = new Date()
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    const currentWeek = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`

    mockPrisma.userStreak.findUnique.mockResolvedValue({ ...mockUserStreak, spendingLastWeek: currentWeek } as never)

    await StreakService.computeSpendingStreakForUser(userId)

    expect(mockPrisma.transaction.aggregate).not.toHaveBeenCalled()
  })
})

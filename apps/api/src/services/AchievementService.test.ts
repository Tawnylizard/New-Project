import { jest, describe, it, beforeEach, expect } from '@jest/globals'

// Mock Prisma
const mockPrisma = {
  userAchievement: {
    upsert: jest.fn<() => Promise<{ id: string; userId: string; achievement: string; unlockedAt: Date }>>(),
    findMany: jest.fn<() => Promise<Array<{ id: string; userId: string; achievement: string; unlockedAt: Date }>>>().mockResolvedValue([])
  }
}

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: mockPrisma
}))

function makeAchievement(type: string, msAgo = 0) {
  return { id: `ach-${type}`, userId: 'user-1', achievement: type, unlockedAt: new Date(Date.now() - msAgo) }
}

describe('AchievementService.checkAndUnlock', () => {
  let AchievementService: Awaited<ReturnType<typeof import('./AchievementService.js')>>['AchievementService']
  const userId = 'user-1'

  beforeEach(async () => {
    jest.clearAllMocks()
    ;({ AchievementService } = await import('./AchievementService.js'))
  })

  it('unlocks FIRST_IMPORT on IMPORT_COMPLETED', async () => {
    mockPrisma.userAchievement.upsert.mockResolvedValue(makeAchievement('FIRST_IMPORT') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'IMPORT_COMPLETED', { importStreak: 1 })

    expect(result).toContain('FIRST_IMPORT')
    expect(mockPrisma.userAchievement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_achievement: { userId, achievement: 'FIRST_IMPORT' } }
      })
    )
  })

  it('does NOT unlock WEEK_STREAK when streak < 7', async () => {
    mockPrisma.userAchievement.upsert.mockResolvedValue(makeAchievement('FIRST_IMPORT') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'IMPORT_COMPLETED', { importStreak: 5 })

    expect(result).not.toContain('WEEK_STREAK')
    // Only FIRST_IMPORT attempted (WEEK_STREAK and MONTH_STREAK conditions not met)
    expect(mockPrisma.userAchievement.upsert).toHaveBeenCalledTimes(1)
  })

  it('unlocks WEEK_STREAK when streak >= 7', async () => {
    mockPrisma.userAchievement.upsert
      .mockResolvedValueOnce(makeAchievement('FIRST_IMPORT') as never)
      .mockResolvedValueOnce(makeAchievement('WEEK_STREAK') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'IMPORT_COMPLETED', { importStreak: 7 })

    expect(result).toContain('WEEK_STREAK')
  })

  it('unlocks MONTH_STREAK when streak >= 30', async () => {
    mockPrisma.userAchievement.upsert
      .mockResolvedValueOnce(makeAchievement('FIRST_IMPORT') as never)
      .mockResolvedValueOnce(makeAchievement('WEEK_STREAK') as never)
      .mockResolvedValueOnce(makeAchievement('MONTH_STREAK') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'IMPORT_COMPLETED', { importStreak: 30 })

    expect(result).toContain('MONTH_STREAK')
  })

  it('unlocks FIRST_ROAST on ROAST_GENERATED', async () => {
    mockPrisma.userAchievement.upsert.mockResolvedValue(makeAchievement('FIRST_ROAST') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'ROAST_GENERATED')

    expect(result).toContain('FIRST_ROAST')
  })

  it('unlocks GOAL_COMPLETE on GOAL_STATUS_COMPLETED', async () => {
    mockPrisma.userAchievement.upsert.mockResolvedValue(makeAchievement('GOAL_COMPLETE') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'GOAL_STATUS_COMPLETED')

    expect(result).toContain('GOAL_COMPLETE')
  })

  it('unlocks SUBSCRIPTION_KILLER on SUBSCRIPTION_CANCELLED', async () => {
    mockPrisma.userAchievement.upsert.mockResolvedValue(makeAchievement('SUBSCRIPTION_KILLER') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'SUBSCRIPTION_CANCELLED')

    expect(result).toContain('SUBSCRIPTION_KILLER')
  })

  it('does not count as newly unlocked if achievement was created 10 minutes ago (idempotent)', async () => {
    // unlockedAt = 10 minutes ago — not "new"
    mockPrisma.userAchievement.upsert.mockResolvedValue(makeAchievement('FIRST_IMPORT', 10 * 60 * 1000) as never)

    const result = await AchievementService.checkAndUnlock(userId, 'IMPORT_COMPLETED', { importStreak: 1 })

    expect(result).not.toContain('FIRST_IMPORT')
  })

  it('ignores errors from DB without throwing', async () => {
    mockPrisma.userAchievement.upsert.mockRejectedValue(new Error('DB error') as never)

    const result = await AchievementService.checkAndUnlock(userId, 'ROAST_GENERATED')

    expect(result).toEqual([])
  })

  it('attempts REFERRAL_ACE on REFERRAL_CONVERTED_3', async () => {
    mockPrisma.userAchievement.upsert.mockResolvedValue(makeAchievement('REFERRAL_ACE') as never)

    await AchievementService.checkAndUnlock(userId, 'REFERRAL_CONVERTED_3')

    expect(mockPrisma.userAchievement.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.userAchievement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_achievement: { userId, achievement: 'REFERRAL_ACE' } }
      })
    )
  })
})

describe('AchievementService.getAchievements', () => {
  let AchievementService: Awaited<ReturnType<typeof import('./AchievementService.js')>>['AchievementService']
  const userId = 'user-1'

  beforeEach(async () => {
    jest.clearAllMocks()
    ;({ AchievementService } = await import('./AchievementService.js'))
  })

  it('returns all as locked when user has no achievements', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([])

    const result = await AchievementService.getAchievements(userId)

    expect(result.unlocked).toHaveLength(0)
    expect(result.locked).toHaveLength(9)
  })

  it('returns correct split of unlocked and locked', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([
      makeAchievement('FIRST_IMPORT'),
      makeAchievement('FIRST_ROAST')
    ] as never)

    const result = await AchievementService.getAchievements(userId)

    expect(result.unlocked).toHaveLength(2)
    expect(result.locked).toHaveLength(7)
    expect(result.unlocked[0]?.type).toBe('FIRST_IMPORT')
  })

  it('includes emoji, name, description, and unlockedAt in unlocked achievements', async () => {
    mockPrisma.userAchievement.findMany.mockResolvedValue([
      makeAchievement('FIRST_IMPORT')
    ] as never)

    const result = await AchievementService.getAchievements(userId)

    const unlocked = result.unlocked[0]
    expect(unlocked?.emoji).toBe('📂')
    expect(unlocked?.name).toBe('Первый шаг')
    expect(unlocked?.unlockedAt).toBeDefined()
  })
})

describe('AchievementService.getShareText', () => {
  let AchievementService: Awaited<ReturnType<typeof import('./AchievementService.js')>>['AchievementService']

  beforeEach(async () => {
    ;({ AchievementService } = await import('./AchievementService.js'))
  })

  it('returns share text with emoji and no financial amounts', () => {
    const text = AchievementService.getShareText('FIRST_IMPORT')

    expect(text).toContain('📂')
    expect(text).toContain('Первый шаг')
    expect(text).not.toMatch(/₽\d+/)
  })

  it('includes bot mention in share text', () => {
    const text = AchievementService.getShareText('WEEK_STREAK')
    expect(text).toContain('🔥')
  })
})

describe('ACHIEVEMENT_CATALOGUE', () => {
  it('has all 9 achievement types', async () => {
    const { ACHIEVEMENT_CATALOGUE } = await import('./AchievementService.js')
    expect(Object.keys(ACHIEVEMENT_CATALOGUE)).toHaveLength(9)
  })

  it('every achievement has emoji, name, and description', async () => {
    const { ACHIEVEMENT_CATALOGUE } = await import('./AchievementService.js')
    for (const [, meta] of Object.entries(ACHIEVEMENT_CATALOGUE)) {
      expect(meta.emoji).toBeTruthy()
      expect(meta.name).toBeTruthy()
      expect(meta.description).toBeTruthy()
    }
  })
})

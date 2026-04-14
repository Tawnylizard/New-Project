import { prisma } from '@klyovo/db'
import { getRedisClient } from '../plugins/rateLimit.js'
import type { AchievementType, AchievementMeta, UnlockedAchievement } from '@klyovo/shared'

const ACHIEVEMENT_CACHE_TTL = 300 // 5 min — shorter than streak cache, changes on unlock

export type TriggerEvent =
  | 'IMPORT_COMPLETED'
  | 'ROAST_GENERATED'
  | 'GOAL_STATUS_COMPLETED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'BUDGET_MASTER_TRIGGER'
  | 'SHARE_ACTION'
  | 'REFERRAL_CONVERTED_3'

export const ACHIEVEMENT_CATALOGUE: Record<AchievementType, AchievementMeta> = {
  FIRST_IMPORT:        { type: 'FIRST_IMPORT',        emoji: '📂', name: 'Первый шаг',           description: 'Первый CSV-импорт' },
  WEEK_STREAK:         { type: 'WEEK_STREAK',          emoji: '🔥', name: 'Неделя не сломался',   description: 'Стрик 7 дней' },
  MONTH_STREAK:        { type: 'MONTH_STREAK',         emoji: '💎', name: 'Месяц железная воля',  description: 'Стрик 30 дней' },
  FIRST_ROAST:         { type: 'FIRST_ROAST',          emoji: '🥊', name: 'Принял удар',          description: 'Первый роаст' },
  GOAL_COMPLETE:       { type: 'GOAL_COMPLETE',        emoji: '🏆', name: 'Цель достигнута',      description: 'Финансовая цель выполнена' },
  SUBSCRIPTION_KILLER: { type: 'SUBSCRIPTION_KILLER',  emoji: '🎯', name: 'Охотник на паразитов', description: 'Подписка-паразит отменена' },
  BUDGET_MASTER:       { type: 'BUDGET_MASTER',        emoji: '💰', name: 'Бюджет-мастер',        description: '4 недели трат ниже предыдущей' },
  SOCIAL_SHARER:       { type: 'SOCIAL_SHARER',        emoji: '📢', name: 'Вирусный финансист',   description: 'Поделился ачивкой или роастом' },
  REFERRAL_ACE:        { type: 'REFERRAL_ACE',         emoji: '👑', name: 'Клёво-амбассадор',     description: 'Привёл 3+ реферальных пользователей' }
}

const TRIGGER_MAP: Record<TriggerEvent, Array<{ type: AchievementType; condition?: (streak: number) => boolean }>> = {
  IMPORT_COMPLETED:       [
    { type: 'FIRST_IMPORT' },
    { type: 'WEEK_STREAK',  condition: (streak) => streak >= 7 },
    { type: 'MONTH_STREAK', condition: (streak) => streak >= 30 }
  ],
  ROAST_GENERATED:        [{ type: 'FIRST_ROAST' }],
  GOAL_STATUS_COMPLETED:  [{ type: 'GOAL_COMPLETE' }],
  SUBSCRIPTION_CANCELLED: [{ type: 'SUBSCRIPTION_KILLER' }],
  BUDGET_MASTER_TRIGGER:  [{ type: 'BUDGET_MASTER' }],
  SHARE_ACTION:           [{ type: 'SOCIAL_SHARER' }],
  REFERRAL_CONVERTED_3:   [{ type: 'REFERRAL_ACE' }]
}

export class AchievementService {
  static async checkAndUnlock(
    userId: string,
    event: TriggerEvent,
    context?: { importStreak?: number }
  ): Promise<AchievementType[]> {
    const candidates = TRIGGER_MAP[event]
    if (!candidates?.length) return []

    const newlyUnlocked: AchievementType[] = []

    for (const candidate of candidates) {
      if (candidate.condition) {
        const streak = context?.importStreak ?? 0
        if (!candidate.condition(streak)) continue
      }

      try {
        // create() throws on @@unique conflict → achievement already exists
        await prisma.userAchievement.create({
          data: { userId, achievement: candidate.type as never }
        })
        // create() succeeded → was genuinely new
        newlyUnlocked.push(candidate.type)
      } catch {
        // Unique constraint violation = already unlocked → skip silently
        // Any other error → also skip (achievement unlock is non-critical)
      }
    }

    if (newlyUnlocked.length > 0) {
      // Invalidate cache so next getAchievements reflects new unlocks
      await AchievementService.invalidateAchievementCache(userId).catch(() => null)
    }

    return newlyUnlocked
  }

  static async isUnlocked(userId: string, achievementType: AchievementType): Promise<boolean> {
    const record = await prisma.userAchievement.findUnique({
      where: { userId_achievement: { userId, achievement: achievementType as never } }
    })
    return record !== null
  }

  static async getAchievements(userId: string): Promise<{
    unlocked: UnlockedAchievement[]
    locked: AchievementMeta[]
  }> {
    const cacheKey = `achievements:${userId}`
    const redis = getRedisClient()

    try {
      const cached = await redis.get(cacheKey)
      if (cached) return JSON.parse(cached) as { unlocked: UnlockedAchievement[]; locked: AchievementMeta[] }
    } catch {
      // Redis unavailable — fall through to DB
    }

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'asc' }
    })

    const unlockedTypes = new Set(userAchievements.map(a => a.achievement as AchievementType))

    const unlocked: UnlockedAchievement[] = userAchievements.map(ua => ({
      ...ACHIEVEMENT_CATALOGUE[ua.achievement as AchievementType],
      unlockedAt: ua.unlockedAt.toISOString()
    }))

    const locked: AchievementMeta[] = (Object.keys(ACHIEVEMENT_CATALOGUE) as AchievementType[])
      .filter(type => !unlockedTypes.has(type))
      .map(type => ACHIEVEMENT_CATALOGUE[type])

    const result = { unlocked, locked }

    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', ACHIEVEMENT_CACHE_TTL)
    } catch {
      // Redis unavailable — continue without caching
    }

    return result
  }

  static async invalidateAchievementCache(userId: string): Promise<void> {
    try {
      const redis = getRedisClient()
      await redis.del(`achievements:${userId}`)
    } catch {
      // Redis unavailable — no-op
    }
  }

  static getShareText(achievementType: AchievementType): string {
    const meta = ACHIEVEMENT_CATALOGUE[achievementType]
    return `${meta.emoji} ${meta.name} — я слежу за своими финансами в Клёво! 🔥 @KlyovoBot`
  }
}

import { prisma } from '@klyovo/db'
import type { AchievementType, AchievementMeta, UnlockedAchievement } from '@klyovo/shared'

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
        const result = await prisma.userAchievement.upsert({
          where: { userId_achievement: { userId, achievement: candidate.type as never } },
          create: { userId, achievement: candidate.type as never },
          update: {}
        })
        // Only count as newly unlocked if the record was just created
        // We compare createdAt/unlockedAt proximity to now
        const ageMs = Date.now() - result.unlockedAt.getTime()
        if (ageMs < 5000) {
          newlyUnlocked.push(candidate.type)
        }
      } catch {
        // Ignore errors — achievement unlock is non-critical
      }
    }

    return newlyUnlocked
  }

  static async getAchievements(userId: string): Promise<{
    unlocked: UnlockedAchievement[]
    locked: AchievementMeta[]
  }> {
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

    return { unlocked, locked }
  }

  static getShareText(achievementType: AchievementType): string {
    const meta = ACHIEVEMENT_CATALOGUE[achievementType]
    return `${meta.emoji} ${meta.name} — я слежу за своими финансами в Клёво! 🔥 @KlyovoBot`
  }
}

import { prisma } from '@klyovo/db'
import { getRedisClient } from '../plugins/rateLimit.js'

const CACHE_TTL_SECONDS = 3600

function getMoscowDateString(date: Date): string {
  // Returns YYYY-MM-DD in UTC+3 (Moscow time)
  return date.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('.').reverse().join('-')
}

function dateDiffInDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const aDay = Math.floor(a.getTime() / msPerDay)
  const bDay = Math.floor(b.getTime() / msPerDay)
  return Math.abs(aDay - bDay)
}

function getISOWeek(date: Date): string {
  // Returns ISO week string like "2026-W15"
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getPreviousISOWeek(isoWeek: string): string {
  const [year, weekStr] = isoWeek.split('-W')
  const week = parseInt(weekStr ?? '1', 10)
  if (week > 1) return `${year}-W${String(week - 1).padStart(2, '0')}`
  // Previous year, last week
  const prevYear = parseInt(year ?? '2026', 10) - 1
  // ISO weeks in previous year: either 52 or 53
  const dec28 = new Date(prevYear, 11, 28)
  const lastWeek = parseInt(getISOWeek(dec28).split('-W')[1] ?? '52', 10)
  return `${prevYear}-W${String(lastWeek).padStart(2, '0')}`
}

export interface UpdateStreakResult {
  newStreak: number
  wasReset: boolean
  longestStreak: number
}

export class StreakService {
  static async getStreaks(userId: string) {
    const redis = getRedisClient()
    const cacheKey = `streak:${userId}`

    try {
      const cached = await redis.get(cacheKey)
      if (cached) return JSON.parse(cached) as ReturnType<typeof StreakService.formatStreak>
    } catch {
      // Redis unavailable — fall through to DB
    }

    const streak = await prisma.userStreak.findUnique({ where: { userId } })
    const result = StreakService.formatStreak(streak)

    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS)
    } catch {
      // Redis unavailable — continue without caching
    }

    return result
  }

  private static formatStreak(streak: {
    importStreak: number
    importStreakLongest: number
    importLastDate: Date | null
    spendingStreak: number
    spendingStreakLongest: number
    spendingLastWeek: string | null
  } | null) {
    return {
      importStreak: {
        current: streak?.importStreak ?? 0,
        longest: streak?.importStreakLongest ?? 0,
        lastActiveDate: streak?.importLastDate
          ? streak.importLastDate.toISOString().split('T')[0]
          : undefined
      },
      spendingStreak: {
        current: streak?.spendingStreak ?? 0,
        longest: streak?.spendingStreakLongest ?? 0,
        lastComputedWeek: streak?.spendingLastWeek ?? undefined
      }
    }
  }

  static async updateImportStreak(userId: string): Promise<UpdateStreakResult> {
    // actionDate computed server-side in UTC+3 (Moscow time)
    const now = new Date()
    const todayStr = getMoscowDateString(now)
    const today = new Date(todayStr)

    const streak = await prisma.userStreak.upsert({
      where: { userId },
      create: {
        userId,
        importStreak: 1,
        importStreakLongest: 1,
        importLastDate: today
      },
      update: {}
    })

    if (!streak.importLastDate) {
      const updated = await prisma.userStreak.update({
        where: { userId },
        data: { importStreak: 1, importStreakLongest: 1, importLastDate: today }
      })
      await StreakService.invalidateCache(userId)
      return { newStreak: updated.importStreak, wasReset: false, longestStreak: updated.importStreakLongest }
    }

    const daysDiff = dateDiffInDays(today, streak.importLastDate)

    let newStreak: number
    let wasReset: boolean

    if (daysDiff === 0) {
      // Same day — already counted
      return { newStreak: streak.importStreak, wasReset: false, longestStreak: streak.importStreakLongest }
    } else if (daysDiff <= 2) {
      // Consecutive or grace period — extend streak
      newStreak = streak.importStreak + 1
      wasReset = false
    } else {
      // Streak broken
      newStreak = 1
      wasReset = true
    }

    const newLongest = Math.max(newStreak, streak.importStreakLongest)

    const updated = await prisma.userStreak.update({
      where: { userId },
      data: {
        importStreak: newStreak,
        importStreakLongest: newLongest,
        importLastDate: today
      }
    })

    await StreakService.invalidateCache(userId)
    return { newStreak: updated.importStreak, wasReset, longestStreak: updated.importStreakLongest }
  }

  static async invalidateCache(userId: string): Promise<void> {
    try {
      const redis = getRedisClient()
      await redis.del(`streak:${userId}`)
    } catch {
      // Redis unavailable — no-op
    }
  }

  static async computeSpendingStreakForUser(userId: string): Promise<void> {
    const currentWeek = getISOWeek(new Date())
    const previousWeek = getPreviousISOWeek(currentWeek)

    const streak = await prisma.userStreak.findUnique({ where: { userId } })

    // Skip if already computed this week
    if (streak?.spendingLastWeek === currentWeek) return

    const [currentWeekStart, currentWeekEnd] = isoWeekToDateRange(currentWeek)
    const [previousWeekStart, previousWeekEnd] = isoWeekToDateRange(previousWeek)

    const [currentResult, previousResult] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, transactionDate: { gte: currentWeekStart, lte: currentWeekEnd }, amountKopecks: { gt: 0 } },
        _sum: { amountKopecks: true }
      }),
      prisma.transaction.aggregate({
        where: { userId, transactionDate: { gte: previousWeekStart, lte: previousWeekEnd }, amountKopecks: { gt: 0 } },
        _sum: { amountKopecks: true }
      })
    ])

    const currentTotal = currentResult._sum.amountKopecks ?? 0
    const previousTotal = previousResult._sum.amountKopecks ?? 0

    // Freeze if no data for either week
    if (currentTotal === 0 || previousTotal === 0) return

    const currentStreakVal = streak?.spendingStreak ?? 0
    const currentLongest = streak?.spendingStreakLongest ?? 0

    let newSpendingStreak: number
    if (currentTotal < previousTotal) {
      newSpendingStreak = currentStreakVal + 1
    } else {
      newSpendingStreak = 0
    }

    const newLongest = Math.max(newSpendingStreak, currentLongest)

    await prisma.userStreak.upsert({
      where: { userId },
      create: {
        userId,
        spendingStreak: newSpendingStreak,
        spendingStreakLongest: newLongest,
        spendingLastWeek: currentWeek
      },
      update: {
        spendingStreak: newSpendingStreak,
        spendingStreakLongest: newLongest,
        spendingLastWeek: currentWeek
      }
    })

    await StreakService.invalidateCache(userId)
  }
}

function isoWeekToDateRange(isoWeek: string): [Date, Date] {
  const [yearStr, weekStr] = isoWeek.split('-W')
  const year = parseInt(yearStr ?? '2026', 10)
  const week = parseInt(weekStr ?? '1', 10)

  // ISO week starts on Monday
  const jan4 = new Date(year, 0, 4) // Jan 4 is always in week 1
  const dayOfWeek = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1)

  const weekStart = new Date(week1Monday)
  weekStart.setDate(week1Monday.getDate() + (week - 1) * 7)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return [weekStart, weekEnd]
}

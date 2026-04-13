import { prisma } from '@klyovo/db'
import type { AnalyticsSummaryResponse, AnalyticsPeriod } from '@klyovo/shared'
import { getRedisClient } from '../plugins/rateLimit.js'

interface PeriodRange {
  from: Date
  to: Date
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function subMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

function getPeriodRange(period: AnalyticsPeriod): { current: PeriodRange; previous: PeriodRange } {
  const now = new Date()

  if (period === 'month') {
    return {
      current: { from: startOfMonth(now), to: endOfMonth(now) },
      previous: {
        from: startOfMonth(subMonths(now, 1)),
        to: endOfMonth(subMonths(now, 1))
      }
    }
  } else if (period === 'last_month') {
    const lastMonth = subMonths(now, 1)
    return {
      current: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) },
      previous: {
        from: startOfMonth(subMonths(now, 2)),
        to: endOfMonth(subMonths(now, 2))
      }
    }
  } else if (period === '3months') {
    return {
      current: { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) },
      previous: {
        from: startOfMonth(subMonths(now, 5)),
        to: endOfMonth(subMonths(now, 3))
      }
    }
  } else {
    throw new Error(`Invalid period: ${String(period)}`)
  }
}

export class AnalyticsService {
  static async computeSummary(
    userId: string,
    period: AnalyticsPeriod
  ): Promise<AnalyticsSummaryResponse> {
    const cacheKey = `analytics:${userId}:${period}`

    try {
      const redis = getRedisClient()
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached) as AnalyticsSummaryResponse
      }
    } catch {
      // Redis unavailable — proceed without cache
    }

    const { current, previous } = getPeriodRange(period)

    const [currentTxns, previousTotal] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['category'],
        where: { userId, transactionDate: { gte: current.from, lte: current.to } },
        _sum: { amountKopecks: true },
        _count: { id: true }
      }),
      prisma.transaction.aggregate({
        where: { userId, transactionDate: { gte: previous.from, lte: previous.to } },
        _sum: { amountKopecks: true }
      })
    ])

    const totalKopecks = currentTxns.reduce(
      (sum, row) => sum + (row._sum.amountKopecks ?? 0),
      0
    )
    const previousTotalKopecks = previousTotal._sum.amountKopecks ?? 0

    const changePercent =
      previousTotalKopecks > 0
        ? Math.round(((totalKopecks - previousTotalKopecks) / previousTotalKopecks) * 1000) / 10
        : null

    const topCategories = [...currentTxns]
      .sort((a, b) => (b._sum.amountKopecks ?? 0) - (a._sum.amountKopecks ?? 0))
      .slice(0, 5)
      .map(row => ({
        category: row.category,
        totalKopecks: row._sum.amountKopecks ?? 0,
        percentage:
          totalKopecks > 0
            ? Math.round(((row._sum.amountKopecks ?? 0) / totalKopecks) * 1000) / 10
            : 0,
        transactionCount: row._count.id
      }))

    const transactionCount = currentTxns.reduce((sum, row) => sum + row._count.id, 0)

    const result: AnalyticsSummaryResponse = {
      period: { from: current.from.toISOString(), to: current.to.toISOString() },
      totalKopecks,
      previousTotalKopecks,
      changePercent,
      topCategories,
      transactionCount
    }

    try {
      const redis = getRedisClient()
      await redis.setex(cacheKey, 300, JSON.stringify(result))
    } catch {
      // Redis unavailable — skip cache write
    }

    return result
  }

  static async invalidateCache(userId: string): Promise<void> {
    try {
      const redis = getRedisClient()
      const keys = await redis.keys(`analytics:${userId}:*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch {
      // Redis unavailable — cache will expire naturally
    }
  }
}

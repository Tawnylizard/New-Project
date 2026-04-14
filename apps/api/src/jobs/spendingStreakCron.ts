import { prisma } from '@klyovo/db'
import { StreakService } from '../services/StreakService.js'
import { AchievementService } from '../services/AchievementService.js'

// Runs every Sunday at 23:59 UTC+3 (20:59 UTC)
// Cron expression: '59 20 * * 0'
export const SPENDING_STREAK_CRON = '59 20 * * 0'

export async function runSpendingStreakJob(): Promise<void> {
  const startTime = Date.now()
  let processed = 0
  let errors = 0

  try {
    // Get all users with recent transaction activity (last 14 days)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)

    const activeUserIds = await prisma.transaction.findMany({
      where: { transactionDate: { gte: cutoff } },
      select: { userId: true },
      distinct: ['userId']
    })

    for (const { userId } of activeUserIds) {
      try {
        await StreakService.computeSpendingStreakForUser(userId)

        // Check BUDGET_MASTER: 4+ consecutive weeks under budget
        const streak = await prisma.userStreak.findUnique({ where: { userId } })
        if (streak && streak.spendingStreak >= 4) {
          await AchievementService.checkAndUnlock(userId, 'BUDGET_MASTER_TRIGGER')
        }

        processed++
      } catch {
        errors++
      }
    }

    const durationMs = Date.now() - startTime
    console.info({ usersProcessed: processed, errors, durationMs }, 'cron.spending_streak_complete')
  } catch (err) {
    console.error({ err }, 'cron.spending_streak_fatal')
    throw err
  }
}

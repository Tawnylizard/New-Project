import { prisma } from '@klyovo/db'
import type { ReferralStatsResponse } from '@klyovo/shared'

const BOT_USERNAME = process.env['BOT_USERNAME'] ?? 'klyovobot'

export class ReferralService {
  static async getReferralStats(userId: string): Promise<ReferralStatsResponse> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const { referralCode } = user
    const referralLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${referralCode}`

    const [invitedCount, activeCount] = await Promise.all([
      prisma.user.count({ where: { referredBy: referralCode } }),
      prisma.user.count({
        where: { referredBy: referralCode, transactions: { some: {} } }
      })
    ])

    return { referralCode, referralLink, invitedCount, activeCount }
  }

  static async registerReferral(currentUserId: string, incomingReferralCode: string): Promise<void> {
    const currentUser = await prisma.user.findUniqueOrThrow({ where: { id: currentUserId } })

    // Idempotent — first referrer wins, never overwrite
    if (currentUser.referredBy !== null) {
      return
    }

    const referrer = await prisma.user.findUnique({
      where: { referralCode: incomingReferralCode }
    })

    if (!referrer) {
      throw Object.assign(new Error('Referral code not found'), {
        statusCode: 404,
        code: 'REFERRAL_CODE_NOT_FOUND'
      })
    }

    if (referrer.id === currentUserId) {
      throw Object.assign(new Error('Self-referral is not allowed'), {
        statusCode: 400,
        code: 'SELF_REFERRAL'
      })
    }

    await prisma.user.update({
      where: { id: currentUserId },
      data: { referredBy: incomingReferralCode }
    })
  }
}

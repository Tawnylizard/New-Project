import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/jwt.js'
import { StreakService } from '../services/StreakService.js'
import { AchievementService } from '../services/AchievementService.js'
import type { JwtPayload } from '../plugins/jwt.js'
import type { GetStreaksResponse, GetAchievementsResponse, ShareAchievementResponse } from '@klyovo/shared'

const ACHIEVEMENT_TYPES = [
  'FIRST_IMPORT', 'WEEK_STREAK', 'MONTH_STREAK', 'FIRST_ROAST',
  'GOAL_COMPLETE', 'SUBSCRIPTION_KILLER', 'BUDGET_MASTER', 'SOCIAL_SHARER', 'REFERRAL_ACE'
] as const

const shareSchema = z.object({
  achievementType: z.enum(ACHIEVEMENT_TYPES)
})

// GET /streaks + POST /streaks/share
export const streakRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // GET /streaks — get user's current streak data
  app.get('/', async (req): Promise<GetStreaksResponse> => {
    const { userId } = req.user as JwtPayload
    return StreakService.getStreaks(userId)
  })

  // POST /streaks/share — record share action, return share text
  app.post<{ Body: z.infer<typeof shareSchema> }>(
    '/share',
    async (req, reply): Promise<ShareAchievementResponse> => {
      const { userId } = req.user as JwtPayload
      const { achievementType } = shareSchema.parse(req.body)

      // Verify the achievement is unlocked (checks against userId — no cross-user risk)
      const isUnlocked = await AchievementService.isUnlocked(userId, achievementType)

      if (!isUnlocked) {
        reply.status(400)
        throw Object.assign(
          new Error('Ачивка не разблокирована'),
          { statusCode: 400, code: 'ACHIEVEMENT_NOT_UNLOCKED' }
        )
      }

      const shareText = AchievementService.getShareText(achievementType)
      const newlyUnlocked = await AchievementService.checkAndUnlock(userId, 'SHARE_ACTION')

      reply.status(200)
      return { shareText, newlyUnlocked }
    }
  )
}

// GET /achievements — separate prefix, no /streaks nesting
export const achievementRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  app.get('/', async (req): Promise<GetAchievementsResponse> => {
    const { userId } = req.user as JwtPayload
    return AchievementService.getAchievements(userId)
  })
}

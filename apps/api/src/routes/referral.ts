import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/jwt.js'
import { ReferralService } from '../services/ReferralService.js'
import type { JwtPayload } from '../plugins/jwt.js'
import type { ReferralStatsResponse } from '@klyovo/shared'

const referralRegisterSchema = z.object({
  referralCode: z.string().regex(/^[a-z0-9]{10,25}$/, 'Invalid referral code format')
})

export const referralRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // GET /referral — return stats for authenticated user
  app.get('/', async (req): Promise<ReferralStatsResponse> => {
    const { userId } = req.user as JwtPayload
    return ReferralService.getReferralStats(userId)
  })

  // POST /referral/register — record referral attribution
  app.post<{ Body: z.infer<typeof referralRegisterSchema> }>(
    '/register',
    async (req, reply) => {
      const { userId } = req.user as JwtPayload
      const { referralCode } = referralRegisterSchema.parse(req.body)
      await ReferralService.registerReferral(userId, referralCode)
      reply.status(200)
      return { ok: true }
    }
  )
}

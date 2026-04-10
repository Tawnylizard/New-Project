import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@klyovo/db'
import { validateTelegramInitData } from '../plugins/telegram.js'
import { JWT_TTL_SECONDS } from '../plugins/jwt.js'
import type { AuthTelegramResponse } from '@klyovo/shared'

const authBodySchema = z.object({
  initData: z.string().min(1),
  referralCode: z.string().max(20).optional()
})

export const authRoutes: FastifyPluginAsync = async app => {
  app.post<{ Body: z.infer<typeof authBodySchema> }>(
    '/telegram',
    {
      schema: {
        body: {
          type: 'object',
          required: ['initData'],
          properties: { initData: { type: 'string', minLength: 1 } }
        }
      }
    },
    async (req, reply): Promise<AuthTelegramResponse> => {
      const { initData, referralCode } = authBodySchema.parse(req.body)

      const parsed = validateTelegramInitData(initData)
      const { user: tgUser } = parsed

      const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')

      // Resolve referrer ID if referral code provided
      let referredById: string | null = null
      if (referralCode) {
        const referrer = await prisma.user.findFirst({
          where: { referralCode },
          select: { id: true }
        })
        // Prevent self-referral (checked after upsert — referrer must be a different user)
        if (referrer) referredById = referrer.id
      }

      const user = await prisma.user.upsert({
        where: { telegramId: BigInt(tgUser.id) },
        update: {
          telegramUsername: tgUser.username ?? null,
          displayName,
          updatedAt: new Date()
        },
        create: {
          telegramId: BigInt(tgUser.id),
          telegramUsername: tgUser.username ?? null,
          displayName,
          plan: 'FREE',
          consentGivenAt: new Date(),
          // Only set referredBy on creation; guard against self-referral
          referredBy: referredById
        }
      })

      // Prevent self-referral: clear if referrer === new user
      if (user.referredBy === user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { referredBy: null }
        })
        user.referredBy = null
      }

      const token = app.jwt.sign(
        { userId: user.id, telegramId: String(user.telegramId), plan: user.plan },
        { expiresIn: JWT_TTL_SECONDS }
      )

      reply.status(200)
      return {
        token,
        user: {
          id: user.id,
          displayName: user.displayName,
          plan: user.plan,
          planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
          referralCode: user.referralCode
        }
      }
    }
  )
}

import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@klyovo/db'

const yukassaWebhookSchema = z.object({
  type: z.string(),
  event: z.string(),
  object: z.object({
    id: z.string(),
    status: z.string(),
    amount: z.object({ value: z.string(), currency: z.string() }),
    metadata: z.object({
      userId: z.string().optional(),
      plan: z.enum(['plus_monthly', 'plus_yearly']).optional()
    }).optional(),
    paid: z.boolean()
  })
})

type YookassaWebhookPayload = z.infer<typeof yukassaWebhookSchema>

export const webhookRoutes: FastifyPluginAsync = async app => {
  // POST /webhooks/yukassa
  app.post<{ Body: YookassaWebhookPayload }>('/yukassa', async (req, reply) => {
    const YUKASSA_SECRET = process.env['YUKASSA_SECRET_KEY']
    if (!YUKASSA_SECRET) {
      reply.status(500)
      throw new Error('YUKASSA_SECRET_KEY not configured')
    }

    // Validate ЮKassa webhook signature
    const signature = req.headers['authorization'] as string | undefined
    if (!signature) {
      reply.status(401)
      throw Object.assign(new Error('Missing signature'), { statusCode: 401 })
    }

    // Basic auth validation: ЮKassa sends Basic auth with shopId:secretKey
    const expected = `Basic ${Buffer.from(
      `${process.env['YUKASSA_SHOP_ID']}:${YUKASSA_SECRET}`
    ).toString('base64')}`

    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    const valid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
    if (!valid) {
      reply.status(401)
      throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 401 })
    }

    const payload = yukassaWebhookSchema.parse(req.body)
    if (payload.event !== 'payment.succeeded' || !payload.object.paid) {
      reply.status(200)
      return { ok: true }
    }

    const paymentId = payload.object.id
    const metadata = payload.object.metadata ?? {}
    const userId = metadata['userId']
    const plan = metadata['plan'] // typed as 'plus_monthly' | 'plus_yearly' | undefined via Zod

    if (!userId || !plan) {
      app.log.warn({ paymentId }, 'Webhook missing userId or plan in metadata')
      reply.status(200)
      return { ok: true }
    }

    // Idempotency check
    const existing = await prisma.klyovoSubscription.findUnique({
      where: { yookassaPaymentId: paymentId }
    })
    if (existing) {
      reply.status(200)
      return { ok: true }
    }

    const now = new Date()
    const expiresAt = new Date(now)
    if (plan === 'plus_monthly') {
      expiresAt.setDate(expiresAt.getDate() + 30)
    } else {
      expiresAt.setDate(expiresAt.getDate() + 365)
    }

    await prisma.$transaction([
      prisma.klyovoSubscription.create({
        data: {
          userId,
          plan,
          status: 'active',
          yookassaPaymentId: paymentId,
          startedAt: now,
          expiresAt
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: { plan: 'PLUS', planExpiresAt: expiresAt }
      })
    ])

    app.log.info({ userId, plan, paymentId }, 'Subscription activated')

    reply.status(200)
    return { ok: true }
  })
}

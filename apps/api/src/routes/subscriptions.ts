import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma, type Prisma } from '@klyovo/db'
import { requireAuth } from '../plugins/jwt.js'
import { PaymentService } from '../services/PaymentService.js'
import { SubscriptionDetector } from '../services/SubscriptionDetector.js'
import type { JwtPayload } from '../plugins/jwt.js'
import type { SubscriptionListResponse, CheckoutResponse, ScanSubscriptionsResponse, SubscriptionStatusResponse } from '@klyovo/shared'
import { PLUS_MONTHLY_PRICE_KOPECKS, PLUS_YEARLY_PRICE_KOPECKS } from '@klyovo/shared'

type DetectedSubscription = Prisma.DetectedSubscriptionGetPayload<object>

function enrichWithAnnualCost(sub: DetectedSubscription): DetectedSubscription & { annualCost: number } {
  return { ...sub, annualCost: Math.round(sub.estimatedAmount * (365 / sub.frequencyDays)) }
}

const statusQuerySchema = z.object({
  status: z.enum(['active', 'cancelled', 'ignored']).optional()
})

const checkoutSchema = z.object({
  plan: z.enum(['plus_monthly', 'plus_yearly']),
  returnUrl: z.string().url()
})

export const subscriptionRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // POST /subscriptions/scan — detect recurring payments and upsert to DB
  app.post('/scan', async (req): Promise<ScanSubscriptionsResponse> => {
    const payload = req.user as JwtPayload
    const { userId } = payload

    const transactions = await prisma.transaction.findMany({
      where: { userId }
    })

    const detected = SubscriptionDetector.detect(transactions)

    await Promise.all(
      detected.map(sub =>
        prisma.detectedSubscription.upsert({
          where: { userId_merchantName: { userId, merchantName: sub.merchantName } },
          create: {
            userId,
            merchantName: sub.merchantName,
            estimatedAmount: sub.estimatedAmount,
            frequencyDays: sub.frequencyDays,
            lastChargeDate: sub.lastChargeDate,
            occurrences: sub.occurrences,
            status: 'active'
          },
          update: {
            estimatedAmount: sub.estimatedAmount,
            frequencyDays: sub.frequencyDays,
            lastChargeDate: sub.lastChargeDate,
            occurrences: sub.occurrences
            // status intentionally omitted — preserve user's cancelled/ignored choice
          }
        })
      )
    )

    const allSubs = await prisma.detectedSubscription.findMany({
      where: { userId },
      orderBy: { estimatedAmount: 'desc' }
    })

    return { found: detected.length, subscriptions: allSubs.map(enrichWithAnnualCost) }
  })

  // GET /subscriptions — detected parasitic subscriptions
  app.get('/', async (req, reply): Promise<SubscriptionListResponse> => {
    const payload = req.user as JwtPayload
    const { userId } = payload
    const { status } = statusQuerySchema.parse(req.query)

    const subs = await prisma.detectedSubscription.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { estimatedAmount: 'desc' }
    })

    const enriched = subs.map(enrichWithAnnualCost)

    let totalMonthly = 0
    let totalAnnual = 0
    for (const s of subs) {
      if (s.status === 'active') {
        totalMonthly += Math.round(s.estimatedAmount * (30 / s.frequencyDays))
        totalAnnual += Math.round(s.estimatedAmount * (365 / s.frequencyDays))
      }
    }

    return { subscriptions: enriched, totalMonthly, totalAnnual }
  })

  // PATCH /subscriptions/:id — update status
  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/:id',
    async (req, reply) => {
      const payload = req.user as JwtPayload
      const { userId } = payload
      const validStatus = z.enum(['active', 'cancelled', 'ignored']).parse(req.body.status)

      const sub = await prisma.detectedSubscription.findFirst({
        where: { id: req.params['id'], userId }
      })

      if (!sub) {
        reply.status(404)
        throw Object.assign(new Error('Подписка не найдена'), { statusCode: 404, code: 'NOT_FOUND' })
      }

      const updated = await prisma.detectedSubscription.update({
        where: { id: sub.id },
        data: { status: validStatus }
      })

      return { subscription: updated }
    }
  )

  // GET /subscriptions/status — current Клёво Plus plan status for the user
  app.get('/status', async (req): Promise<SubscriptionStatusResponse> => {
    const { userId } = req.user as JwtPayload
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const now = new Date()
    const isActive =
      user.plan === 'PLUS' &&
      (user.planExpiresAt === null || user.planExpiresAt > now)
    return {
      plan: user.plan,
      planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
      isActive
    }
  })

  // POST /subscriptions/checkout — start ЮKassa payment for Клёво Плюс
  app.post<{ Body: z.infer<typeof checkoutSchema> }>(
    '/checkout',
    async (req, reply): Promise<CheckoutResponse> => {
      const payload = req.user as JwtPayload
      const { userId } = payload
      const { plan, returnUrl } = checkoutSchema.parse(req.body)

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
      const amount =
        plan === 'plus_monthly' ? PLUS_MONTHLY_PRICE_KOPECKS : PLUS_YEARLY_PRICE_KOPECKS

      const result = await PaymentService.createPayment({
        userId,
        userEmail: `${user.telegramId}@klyovo.telegram`,
        plan,
        amount,
        returnUrl
      })

      reply.status(200)
      return result
    }
  )
}

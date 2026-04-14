import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma, type Prisma } from '@klyovo/db'
import { requireAuth } from '../plugins/jwt.js'
import { RoastGenerator } from '../services/RoastGenerator.js'
import { AchievementService } from '../services/AchievementService.js'
import type { JwtPayload } from '../plugins/jwt.js'
import type { GenerateRoastResponse } from '@klyovo/shared'
import { FREE_ROAST_LIMIT_PER_MONTH } from '@klyovo/shared'

type Transaction = Prisma.TransactionGetPayload<object>

const generateRoastSchema = z.object({
  mode: z.enum(['harsh', 'soft']),
  periodDays: z.union([z.literal(30), z.literal(60), z.literal(90)])
})

export const roastRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // POST /roast/generate
  app.post<{ Body: z.infer<typeof generateRoastSchema> }>(
    '/generate',
    async (req, reply): Promise<GenerateRoastResponse> => {
      const payload = req.user as JwtPayload
      const { userId } = payload
      const { mode, periodDays } = generateRoastSchema.parse(req.body)

      // Check plan limit
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

      if (user.plan === 'FREE') {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const roastCount = await prisma.roastSession.count({
          where: { userId, createdAt: { gte: startOfMonth } }
        })

        if (roastCount >= FREE_ROAST_LIMIT_PER_MONTH) {
          reply.status(402)
          throw Object.assign(
            new Error('Лимит roast на бесплатном плане исчерпан'),
            { statusCode: 402, code: 'PLAN_LIMIT' }
          )
        }
      }

      // Get transactions for period
      const since = new Date()
      since.setDate(since.getDate() - periodDays)

      const transactions = await prisma.transaction.findMany({
        where: { userId, transactionDate: { gte: since } },
        orderBy: { transactionDate: 'desc' }
      })

      if (transactions.length < 5) {
        reply.status(400)
        throw Object.assign(
          new Error('Недостаточно транзакций для roast. Загрузи выписку.'),
          { statusCode: 400, code: 'INSUFFICIENT_DATA' }
        )
      }

      const roastText = await RoastGenerator.generate(userId, transactions, mode)

      // Build spending summary
      const totalAmount = transactions.reduce((sum: number, t: Transaction) => sum + t.amountKopecks, 0)
      const categorySums = new Map<string, number>()
      for (const t of transactions) {
        categorySums.set(t.category, (categorySums.get(t.category) ?? 0) + t.amountKopecks)
      }
      const topCategories = Array.from(categorySums.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({
          category: category as GenerateRoastResponse['spendingSummary']['topCategories'][0]['category'],
          amount,
          percentage: Math.round((amount / totalAmount) * 100)
        }))

      const bnplTotal = transactions
        .filter((t: Transaction) => t.isBnpl)
        .reduce((sum: number, t: Transaction) => sum + t.amountKopecks, 0)

      const subscriptionsFound = await prisma.detectedSubscription.count({
        where: { userId, status: 'active' }
      })

      const spendingSummary = {
        periodStart: since,
        periodEnd: new Date(),
        totalAmount,
        topCategories,
        subscriptionsFound,
        bnplTotal
      }

      const session = await prisma.roastSession.create({
        data: {
          userId,
          roastText,
          spendingSummary,
          mode
        }
      })

      // Check FIRST_ROAST achievement (non-blocking)
      AchievementService.checkAndUnlock(userId, 'ROAST_GENERATED').catch(() => null)

      const BOT_USERNAME = process.env['TELEGRAM_BOT_USERNAME'] ?? 'klyovobot'

      return {
        roastId: session.id,
        roastText: session.roastText,
        spendingSummary,
        shareUrl: `https://t.me/${BOT_USERNAME}?start=roast_${session.id}`
      }
    }
  )

  // GET /roast/history
  app.get('/history', async (req, reply) => {
    const payload = req.user as JwtPayload
    const { userId } = payload

    const sessions = await prisma.roastSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    reply.status(200)
    return { sessions }
  })

  // POST /roast/:id/share
  app.post<{ Params: { id: string } }>('/:id/share', async (req, reply) => {
    const payload = req.user as JwtPayload
    const { userId } = payload

    const session = await prisma.roastSession.findFirst({
      where: { id: req.params['id'], userId }
    })

    if (!session) {
      reply.status(404)
      throw Object.assign(new Error('Roast не найден'), { statusCode: 404, code: 'NOT_FOUND' })
    }

    await prisma.roastSession.update({
      where: { id: session.id },
      data: { sharedAt: new Date() }
    })

    reply.status(200)
    return { shared: true }
  })
}

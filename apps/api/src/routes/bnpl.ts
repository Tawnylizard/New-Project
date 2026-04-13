import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma, type Prisma } from '@klyovo/db'
import { requireAuth } from '../plugins/jwt.js'
import { BnplDetector } from '../services/BnplDetector.js'
import type { JwtPayload } from '../plugins/jwt.js'
import type { BnplListResponse, ScanBnplResponse, BnplSummary } from '@klyovo/shared'

type BnplObligation = Prisma.BnplObligationGetPayload<object>

function computeRemainingAmount(ob: BnplObligation): number {
  const remaining = Math.max(0, ob.totalInstallments - ob.paidInstallments)
  return remaining * ob.installmentAmount
}

function enrichObligation(ob: BnplObligation): BnplObligation & { remainingAmount: number } {
  return { ...ob, remainingAmount: computeRemainingAmount(ob) }
}

function computeSummary(obligations: BnplObligation[]): BnplSummary {
  const relevant = obligations.filter(o => o.status === 'active' || o.status === 'overdue')

  let totalDebtKopecks = 0
  let nextPaymentDate: Date | null = null
  let nextPaymentAmount = 0

  for (const ob of relevant) {
    totalDebtKopecks += computeRemainingAmount(ob)
    if (ob.nextPaymentDate) {
      if (!nextPaymentDate || ob.nextPaymentDate < nextPaymentDate) {
        nextPaymentDate = ob.nextPaymentDate
        nextPaymentAmount = ob.installmentAmount
      }
    }
  }

  return {
    totalDebtKopecks,
    nextPaymentDate: nextPaymentDate ? nextPaymentDate.toISOString() : null,
    nextPaymentAmount,
    overdueCount: obligations.filter(o => o.status === 'overdue').length,
    activeCount: obligations.filter(o => o.status === 'active').length
  }
}

const statusQuerySchema = z.object({
  status: z.enum(['active', 'completed', 'overdue', 'dismissed']).optional()
})

const patchBodySchema = z.object({
  status: z.enum(['active', 'dismissed'])
})

export const bnplRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // POST /bnpl/scan — detect BNPL obligations from existing transactions
  app.post('/scan', async (req): Promise<ScanBnplResponse> => {
    const payload = req.user as JwtPayload
    const { userId } = payload

    const transactions = await prisma.transaction.findMany({
      where: { userId }
    })

    const detected = BnplDetector.detect(transactions)

    await Promise.all(
      detected.map(ob =>
        prisma.bnplObligation.upsert({
          where: {
            userId_bnplService_merchantName_firstPaymentDate: {
              userId,
              bnplService: ob.bnplService,
              merchantName: ob.merchantName,
              firstPaymentDate: ob.firstPaymentDate
            }
          },
          create: {
            userId,
            bnplService: ob.bnplService,
            merchantName: ob.merchantName,
            merchantDisplay: ob.merchantDisplay,
            installmentAmount: ob.installmentAmount,
            totalInstallments: ob.totalInstallments,
            paidInstallments: ob.paidInstallments,
            firstPaymentDate: ob.firstPaymentDate,
            lastPaymentDate: ob.lastPaymentDate,
            nextPaymentDate: ob.nextPaymentDate,
            frequencyDays: ob.frequencyDays,
            status: ob.status
          },
          update: {
            paidInstallments: ob.paidInstallments,
            lastPaymentDate: ob.lastPaymentDate,
            nextPaymentDate: ob.nextPaymentDate,
            // status intentionally omitted for active/overdue — preserve dismissed
            ...(ob.status === 'completed' ? { status: 'completed' } : {})
          }
        })
      )
    )

    // Update isBnpl flag on matched transactions
    if (detected.length > 0) {
      await Promise.all(
        detected.map(ob =>
          prisma.transaction.updateMany({
            where: {
              userId,
              merchantNormalized: ob.merchantName,
              isBnpl: false
            },
            data: {
              isBnpl: true,
              bnplService: ob.bnplService.toLowerCase().replace(/\s+/g, '_') as 'dolyami' | 'split' | 'podeli'
            }
          })
        )
      )
    }

    const allObligations = await prisma.bnplObligation.findMany({
      where: { userId },
      orderBy: { nextPaymentDate: 'asc' }
    })

    return {
      found: detected.length,
      obligations: allObligations.map(enrichObligation)
    }
  })

  // GET /bnpl — list all BNPL obligations
  app.get('/', async (req): Promise<BnplListResponse> => {
    const payload = req.user as JwtPayload
    const { userId } = payload
    const { status } = statusQuerySchema.parse(req.query)

    const obligations = await prisma.bnplObligation.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { nextPaymentDate: 'asc' }
    })

    return {
      obligations: obligations.map(enrichObligation),
      summary: computeSummary(obligations)
    }
  })

  // PATCH /bnpl/:id — update status (dismiss or restore)
  app.patch<{ Params: { id: string } }>(
    '/:id',
    async (req, reply) => {
      const payload = req.user as JwtPayload
      const { userId } = payload
      const { status } = patchBodySchema.parse(req.body)

      const obligation = await prisma.bnplObligation.findFirst({
        where: { id: req.params['id'], userId }
      })

      if (!obligation) {
        reply.status(404)
        throw Object.assign(new Error('BNPL-обязательство не найдено'), {
          statusCode: 404,
          code: 'NOT_FOUND'
        })
      }

      const updated = await prisma.bnplObligation.update({
        where: { id: obligation.id },
        data: { status }
      })

      return { obligation: enrichObligation(updated) }
    }
  )
}

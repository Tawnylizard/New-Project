import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@klyovo/db'
import { requireAuth } from '../plugins/jwt.js'
import { CsvParser } from '../services/CsvParser.js'
import { SubscriptionDetector } from '../services/SubscriptionDetector.js'
import { AnalyticsService } from '../services/AnalyticsService.js'
import type { JwtPayload } from '../plugins/jwt.js'
import type { ImportTransactionsResponse } from '@klyovo/shared'

const manualTxnSchema = z.object({
  amountKopecks: z.number().int().positive(),
  merchantName: z.string().min(1).max(200),
  category: z.enum([
    'FOOD_CAFE', 'GROCERIES', 'MARKETPLACE', 'TRANSPORT',
    'SUBSCRIPTIONS', 'ENTERTAINMENT', 'HEALTH', 'CLOTHING', 'EDUCATION', 'OTHER'
  ]),
  transactionDate: z.string().datetime(),
  note: z.string().max(500).optional()
})

export const transactionRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // GET /transactions — list user transactions
  app.get('/', async (req, reply) => {
    const payload = req.user as JwtPayload
    const { userId } = payload

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { transactionDate: 'desc' },
      take: 200
    })

    reply.status(200)
    return { transactions }
  })

  // POST /transactions/import — upload CSV
  app.post<{ Body: { bank_type: string } }>(
    '/import',
    async (req, reply): Promise<ImportTransactionsResponse> => {
      const payload = req.user as JwtPayload
      const { userId } = payload

      const data = await req.file()
      if (!data) {
        reply.status(400)
        throw Object.assign(new Error('Файл не загружен'), { statusCode: 400, code: 'PARSE_ERROR' })
      }

      const bankType = (data.fields['bank_type'] as { value?: string } | undefined)?.value ?? 'sber'
      const validBankType = bankType === 'tbank' ? 'tbank' : 'sber'

      const fileBuffer = await data.toBuffer()
      const parsed = await CsvParser.parse(fileBuffer, validBankType)

      if ('error' in parsed) {
        reply.status(400)
        throw Object.assign(new Error('Не удалось прочитать файл. Попробуй скачать выписку снова.'), {
          statusCode: 400,
          code: 'PARSE_ERROR'
        })
      }

      const source = validBankType === 'sber' ? 'CSV_SBER' : 'CSV_TBANK'
      let importedCount = 0

      for (const txn of parsed) {
        try {
          await prisma.transaction.upsert({
            where: {
              userId_transactionDate_amountKopecks_merchantNormalized: {
                userId,
                transactionDate: txn.transactionDate,
                amountKopecks: txn.amountKopecks,
                merchantNormalized: txn.merchantNormalized
              }
            },
            update: {},
            create: {
              userId,
              amountKopecks: txn.amountKopecks,
              merchantName: txn.merchantName,
              merchantNormalized: txn.merchantNormalized,
              category: txn.category,
              transactionDate: txn.transactionDate,
              source,
              rawDescription: txn.rawDescription ?? null,
              isBnpl: txn.isBnpl,
              bnplService: txn.bnplService ?? null
            }
          })
          importedCount++
        } catch {
          // Skip duplicate transactions
        }
      }

      // Refresh subscription detection after import
      const allTxns = await prisma.transaction.findMany({ where: { userId } })
      const detectedSubs = SubscriptionDetector.detect(allTxns)

      for (const sub of detectedSubs) {
        await prisma.detectedSubscription.upsert({
          where: { userId_merchantName: { userId, merchantName: sub.merchantName } },
          update: {
            estimatedAmount: sub.estimatedAmount,
            frequencyDays: sub.frequencyDays,
            lastChargeDate: sub.lastChargeDate,
            occurrences: sub.occurrences
          },
          create: { userId, ...sub }
        })
      }

      // Invalidate analytics cache after import
      await AnalyticsService.invalidateCache(userId)

      const dates = parsed.map(t => t.transactionDate)
      const minDate = dates.reduce((a, b) => (a < b ? a : b))
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))

      const categorySums = new Map<string, number>()
      for (const txn of parsed) {
        categorySums.set(txn.category, (categorySums.get(txn.category) ?? 0) + txn.amountKopecks)
      }

      return {
        importedCount,
        period: { from: minDate.toISOString(), to: maxDate.toISOString() },
        categoriesSummary: Array.from(categorySums.entries()).map(([category, total]) => ({
          category: category as ImportTransactionsResponse['categoriesSummary'][0]['category'],
          total
        }))
      }
    }
  )

  // POST /transactions — manual entry
  app.post<{ Body: z.infer<typeof manualTxnSchema> }>('/', async (req, reply) => {
    const payload = req.user as JwtPayload
    const { userId } = payload
    const body = manualTxnSchema.parse(req.body)

    const { Categorizer } = await import('../services/Categorizer.js')
    const merchantNormalized = body.merchantName.toLowerCase().trim()
    const category = body.category ?? Categorizer.categorize(body.merchantName)

    const txn = await prisma.transaction.create({
      data: {
        userId,
        amountKopecks: body.amountKopecks,
        merchantName: body.merchantName,
        merchantNormalized,
        category,
        transactionDate: new Date(body.transactionDate),
        source: 'MANUAL',
        rawDescription: body.note ?? null
      }
    })

    reply.status(201)
    return { transaction: txn }
  })
}

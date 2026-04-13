import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/jwt.js'
import { AnalyticsService } from '../services/AnalyticsService.js'
import type { JwtPayload } from '../plugins/jwt.js'

const periodSchema = z.enum(['month', 'last_month', '3months']).default('month')

export const analyticsRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // GET /analytics/summary?period=month|last_month|3months
  app.get<{ Querystring: { period?: string } }>('/summary', async (req, reply) => {
    const payload = req.user as JwtPayload
    const { userId } = payload

    const periodParse = periodSchema.safeParse(req.query['period'])
    if (!periodParse.success) {
      reply.status(400)
      throw Object.assign(new Error('Invalid period. Use: month, last_month, 3months'), {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    const summary = await AnalyticsService.computeSummary(userId, periodParse.data)
    return summary
  })
}

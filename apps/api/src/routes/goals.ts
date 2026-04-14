import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@klyovo/db'
import { requireAuth } from '../plugins/jwt.js'
import { GoalService } from '../services/GoalService.js'
import { AchievementService } from '../services/AchievementService.js'
import type { JwtPayload } from '../plugins/jwt.js'
import type { GoalListResponse, GoalAdviceResponse } from '@klyovo/shared'

const GOAL_CATEGORIES = [
  'SAVINGS', 'EMERGENCY_FUND', 'VACATION', 'GADGET', 'EDUCATION', 'HOUSING', 'OTHER'
] as const

const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(GOAL_CATEGORIES),
  targetAmountKopecks: z.number().int().positive(),
  currentAmountKopecks: z.number().int().min(0).default(0),
  deadline: z.string().datetime().optional().nullable()
})

const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currentAmountKopecks: z.number().int().min(0).optional(),
  deadline: z.string().datetime().optional().nullable(),
  status: z.literal('ABANDONED').optional()
})

const statusQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'ABANDONED']).optional()
})

export const goalRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler', requireAuth)

  // POST /goals — create a new financial goal
  app.post<{ Body: z.infer<typeof createGoalSchema> }>('/', async (req, reply) => {
    const { userId } = req.user as JwtPayload
    const body = createGoalSchema.parse(req.body)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

    const deadline = body.deadline ? new Date(body.deadline) : null

    if (deadline && deadline <= new Date()) {
      reply.status(400)
      throw Object.assign(new Error('Дедлайн должен быть в будущем'), { statusCode: 400, code: 'INVALID_DEADLINE' })
    }

    const goal = await GoalService.create({
      userId,
      name: body.name,
      category: body.category,
      targetAmountKopecks: body.targetAmountKopecks,
      currentAmountKopecks: body.currentAmountKopecks,
      deadline,
      isPlusPlan: user.plan === 'PLUS'
    })

    reply.status(201)
    return { data: goal }
  })

  // GET /goals — list user's goals
  app.get('/', async (req): Promise<GoalListResponse> => {
    const { userId } = req.user as JwtPayload
    const { status } = statusQuerySchema.parse(req.query)

    const goals = await GoalService.list(userId, status)
    return { goals }
  })

  // PUT /goals/:id — update goal (progress, name, deadline, or abandon)
  app.put<{ Params: { id: string }; Body: z.infer<typeof updateGoalSchema> }>(
    '/:id',
    async (req, reply) => {
      const { userId } = req.user as JwtPayload
      const body = updateGoalSchema.parse(req.body)

      const updateParams: Parameters<typeof GoalService.update>[0] = {
        userId,
        goalId: req.params['id']
      }

      if (body.name !== undefined) updateParams.name = body.name
      if (body.currentAmountKopecks !== undefined) updateParams.currentAmountKopecks = body.currentAmountKopecks
      if (body.deadline !== undefined) updateParams.deadline = body.deadline ? new Date(body.deadline) : null
      if (body.status !== undefined) updateParams.status = body.status

      const updated = await GoalService.update(updateParams)

      // Check GOAL_COMPLETE achievement when goal reaches COMPLETED status (non-blocking)
      if (updated.status === 'COMPLETED') {
        AchievementService.checkAndUnlock(userId, 'GOAL_STATUS_COMPLETED').catch(() => null)
      }

      reply.status(200)
      return { data: updated }
    }
  )

  // DELETE /goals/:id — permanently delete a goal
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { userId } = req.user as JwtPayload
    await GoalService.delete(userId, req.params['id'])
    reply.status(204)
  })

  // POST /goals/:id/advice — get AI advice for a goal (PLUS only)
  app.post<{ Params: { id: string } }>('/:id/advice', async (req, reply): Promise<GoalAdviceResponse> => {
    const { userId } = req.user as JwtPayload

    const user = await import('@klyovo/db').then(m => m.prisma.user.findUniqueOrThrow({ where: { id: userId } }))

    if (user.plan !== 'PLUS') {
      reply.status(403)
      throw Object.assign(
        new Error('AI-советы доступны только для подписчиков Клёво Плюс'),
        { statusCode: 403, code: 'PLAN_REQUIRED' }
      )
    }

    const result = await GoalService.generateAdvice(userId, req.params['id'])
    reply.status(200)
    return result
  })
}

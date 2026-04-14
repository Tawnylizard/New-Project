import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { ZodError } from 'zod'
import { authRoutes } from './routes/auth.js'
import { transactionRoutes } from './routes/transactions.js'
import { roastRoutes } from './routes/roast.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { webhookRoutes } from './routes/webhooks.js'
import { analyticsRoutes } from './routes/analytics.js'
import { bnplRoutes } from './routes/bnpl.js'
import { referralRoutes } from './routes/referral.js'
import { goalRoutes } from './routes/goals.js'
import { streakRoutes } from './routes/streaks.js'
import { rateLimitPlugin } from './plugins/rateLimit.js'
import { SPENDING_STREAK_CRON, runSpendingStreakJob } from './jobs/spendingStreakCron.js'
import { MAX_CSV_SIZE_BYTES } from '@klyovo/shared'

const PORT = Number(process.env['PORT'] ?? 3000)
const HOST = process.env['HOST'] ?? '0.0.0.0'

export function buildApp(): ReturnType<typeof Fastify> {
  const JWT_SECRET = process.env['JWT_SECRET']
  if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set')
    process.exit(1)
  }

  const app = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info'
    }
  })

  // ─── Plugins ──────────────────────────────────────────────────────────────
  app.register(cors, {
    origin: process.env['NODE_ENV'] === 'production'
      ? ['https://t.me']
      : true
  })

  app.register(jwt, {
    secret: JWT_SECRET,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] }
  })

  app.register(multipart, {
    limits: { fileSize: MAX_CSV_SIZE_BYTES }
  })

  app.register(rateLimitPlugin)

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.register(authRoutes, { prefix: '/auth' })
  app.register(transactionRoutes, { prefix: '/transactions' })
  app.register(roastRoutes, { prefix: '/roast' })
  app.register(subscriptionRoutes, { prefix: '/subscriptions' })
  app.register(webhookRoutes, { prefix: '/webhooks' })
  app.register(analyticsRoutes, { prefix: '/analytics' })
  app.register(bnplRoutes, { prefix: '/bnpl' })
  app.register(referralRoutes, { prefix: '/referral' })
  app.register(goalRoutes, { prefix: '/goals' })
  app.register(streakRoutes, { prefix: '/streaks' })

  // ─── Health ───────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ─── Error handler ────────────────────────────────────────────────────────
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _req, reply) => {
    app.log.error(error)
    if (error instanceof ZodError) {
      reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message ?? 'Invalid input' } })
      return
    }
    const statusCode = error.statusCode ?? 500
    const code = error.code ?? 'INTERNAL_ERROR'
    reply.status(statusCode).send({
      error: { code, message: error.message }
    })
  })

  return app
}

async function start(): Promise<void> {
  const app = buildApp()
  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`API listening on http://${HOST}:${PORT}`)

    // Schedule spending streak cron (every Sunday at 23:59 UTC+3 = 20:59 UTC)
    const { default: cron } = await import('node-cron')
    cron.schedule(SPENDING_STREAK_CRON, () => {
      runSpendingStreakJob().catch(err => app.log.error(err, 'spendingStreakCron failed'))
    })
    app.log.info(`Spending streak cron scheduled: ${SPENDING_STREAK_CRON}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Only start server when this is the direct entry point, not when imported by tests
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')
if (isMain) {
  start()
}

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { authRoutes } from './routes/auth.js'
import { transactionRoutes } from './routes/transactions.js'
import { roastRoutes } from './routes/roast.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { webhookRoutes } from './routes/webhooks.js'
import { rateLimitPlugin } from './plugins/rateLimit.js'
import { MAX_CSV_SIZE_BYTES } from '@klyovo/shared'

const PORT = Number(process.env['PORT'] ?? 3000)
const HOST = process.env['HOST'] ?? '0.0.0.0'
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev_jwt_secret_change_in_production'

export function buildApp(): ReturnType<typeof Fastify> {
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
    secret: JWT_SECRET
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

  // ─── Health ───────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ─── Error handler ────────────────────────────────────────────────────────
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _req, reply) => {
    app.log.error(error)
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

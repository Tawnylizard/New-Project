import type { FastifyPluginAsync } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'
import Redis from 'ioredis'
import fp from 'fastify-plugin'

// Rate limiter MUST be a singleton — per-request instances bypass protection
let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (!redisClient) {
    const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
    redisClient = new Redis(REDIS_URL, { lazyConnect: true })
    redisClient.on('error', err => {
      console.error('[Redis] connection error:', err)
    })
  }
  return redisClient
}

const rateLimitPlugin: FastifyPluginAsync = async app => {
  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: getRedisClient(),
    keyGenerator: req => {
      // Rate limit by authenticated user ID if available, else by IP
      const authHeader = req.headers['authorization']
      if (authHeader?.startsWith('Bearer ')) {
        return `rl:user:${authHeader.slice(7)}`
      }
      return `rl:ip:${req.ip}`
    },
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMIT', message: 'Слишком много запросов' }
    })
  })
}

export { rateLimitPlugin, getRedisClient }
export default fp(rateLimitPlugin, { name: 'rate-limit' })

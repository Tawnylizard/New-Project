import type { FastifyRequest, FastifyReply } from 'fastify'
import { JWT_TTL_SECONDS } from '@klyovo/shared'

export interface JwtPayload {
  userId: string
  telegramId: string
  plan: string
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' }
    })
  }
}

export { JWT_TTL_SECONDS }

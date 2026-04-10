import type { FastifyRequest, FastifyReply } from 'fastify'

// Mirrors JWT_TTL_SECONDS from @klyovo/shared — 7 days
export const JWT_TTL_SECONDS = 7 * 24 * 60 * 60

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


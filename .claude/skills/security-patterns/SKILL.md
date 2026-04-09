---
name: security-patterns
description: >
  Security patterns and templates for Клёво. Provides encryption utilities,
  API key validation patterns, Telegram initData verification, ЮKassa webhook
  validation, and secure storage templates. Use when implementing authentication,
  payment processing, or any external API integration.
version: "1.0"
maturity: production
---

# Security Patterns — Клёво

Project-specific security patterns extracted from docs/Specification.md and docs/Architecture.md.

## Telegram initData Validation

```typescript
import crypto from 'crypto'

export function validateTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) return false

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computedHash !== receivedHash) return false

  // Check auth_date freshness (max 24h)
  const authDate = parseInt(params.get('auth_date') ?? '0', 10)
  if (Date.now() / 1000 - authDate > 86400) return false

  return true
}
```

## JWT Token Handling

```typescript
import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'

interface KlyovoJwtPayload extends JwtPayload {
  userId: string
  telegramId: string
  plan: 'FREE' | 'PLUS'
}

export function signToken(payload: Omit<KlyovoJwtPayload, keyof JwtPayload>): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    algorithm: 'HS256',  // Always explicit — prevents algorithm confusion
    expiresIn: '7d'
  })
}

export function verifyToken(token: string): KlyovoJwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!, {
    algorithms: ['HS256']  // Whitelist only HS256
  }) as KlyovoJwtPayload
}
```

## ЮKassa Webhook Validation

```typescript
import crypto from 'crypto'

export function validateYukassaWebhook(
  body: string,
  receivedSignature: string,
  secretKey: string
): boolean {
  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  )
}
```

## Input Validation (Zod)

```typescript
import { z } from 'zod'

// CSV upload schema
export const csvUploadSchema = z.object({
  bank: z.enum(['sber', 'tbank']),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional()
})

// Transaction manual entry
export const manualTransactionSchema = z.object({
  amountKopecks: z.number().int().positive().max(100_000_000_00), // 1M RUB max
  merchantName: z.string().min(1).max(200),
  category: z.enum(['food_cafe','groceries','marketplace','transport',
                    'subscriptions','entertainment','health','clothing','education','other']),
  transactionDate: z.string().datetime(),
  isBnpl: z.boolean().default(false),
  bnplService: z.enum(['dolyami','split','podeli']).optional()
})
```

## Rate Limiting Pattern (Redis-backed Singleton)

```typescript
// IMPORTANT: Rate limiter MUST be a singleton — per-request instances bypass protection
import { RateLimiterRedis } from 'rate-limiter-flexible'
import { redis } from './redis'  // shared singleton Redis client

// Create once at module level
export const roastRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'roast_rl',
  points: 20,      // 20 roasts
  duration: 3600,  // per hour
})

export const globalRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'global_rl',
  points: 100,     // 100 requests
  duration: 60,    // per minute
})
```

## Money Safety Pattern

```typescript
// ALWAYS store amounts in kopecks (integers), NEVER use floats
// ₽47.20 → 4720 kopecks

export const kopecksToRubles = (kopecks: number): string =>
  (kopecks / 100).toFixed(2)

export const rublesToKopecks = (rubles: string): number =>
  Math.round(parseFloat(rubles) * 100)

// For display
export const formatRubles = (kopecks: number): string =>
  `₽${(kopecks / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`
```

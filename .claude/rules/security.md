# Security Rules — Клёво

## Critical Security Requirements

### 1. Authentication (Telegram initData)

- ALL API routes MUST validate Telegram initData via HMAC-SHA256
- `auth_date` must be checked: reject if older than 86400 seconds
- JWT TTL = 7 days; always check expiry on every request
- Never trust client-side claims without server-side verification
- Reject requests with missing or tampered Authorization headers

```typescript
// Required validation on every protected endpoint
const HMAC_KEY = crypto.createHash('sha256').update(BOT_TOKEN).digest()
const computed = crypto.createHmac('sha256', HMAC_KEY).update(dataCheckString).digest('hex')
if (computed !== received_hash) throw new AuthError('INVALID_INIT_DATA')
if (Date.now()/1000 - auth_date > 86400) throw new AuthError('EXPIRED_INIT_DATA')
```

### 2. Input Validation (Zod)

- EVERY Fastify endpoint MUST have a Zod schema for request body, params, and query
- Never use `as any` to bypass validation
- File uploads: validate size < 5MB BEFORE writing to Object Storage
- Validate CSV encoding (UTF-8 → fallback CP1251) before parsing

```typescript
// Required on every route
schema: {
  body: z.object({ ... }),
  params: z.object({ ... }),
  querystring: z.object({ ... })
}
```

### 3. Database Security

- Use Prisma parameterized queries exclusively — NEVER raw SQL with string interpolation
- Row Level Security must be enforced via Prisma middleware (userId filter)
- Never return other users' data; always scope queries by authenticated userId
- Encrypted at rest via Yandex Cloud (ru-central1 only — ФЗ-152)

```typescript
// Always scope to authenticated user
await prisma.transaction.findMany({
  where: { userId: req.user.id }  // NEVER omit this
})
```

### 4. External API Security (YandexGPT, GigaChat, ЮKassa)

- API keys stored ONLY in Yandex Lockbox (never in .env files in production)
- All external API calls go through typed service classes, never direct fetch
- Circuit breaker pattern required for LLM calls (timeout 5s, fallback to GigaChat, then cached)
- Payment webhooks: validate ЮKassa signature before processing
- ЮKassa idempotency: check payment_id before processing to prevent double-charges

### 5. File Handling (CSV)

- CSV files: store in Yandex Object Storage with TTL = 1 hour (lifecycle rule)
- Delete immediately after parsing, never persist to database
- Max file size: 5MB — reject before upload
- Sanitize all parsed data before database insertion

### 6. Rate Limiting

```
Global:     100 req/min per user (Redis-backed)
Roast:      20 roasts/hour per user
Auth:       10 attempts/15min per IP
```

### 7. Secrets Management

- Development: `.env` file (in .gitignore)
- Production: Yandex Lockbox environment variables
- NEVER hardcode API keys, tokens, or secrets in source code
- NEVER commit `.env` files
- Required `.gitignore` entries: `.env`, `.env.*`, `*.key`, `*.pem`

### 8. HTTPS & Transport

- All communication over HTTPS/TLS 1.3
- No HTTP fallback in production
- CORS: restrict to Telegram Mini App origins only

### 9. Personal Data (ФЗ-152)

- ALL personal data stored ONLY in Yandex Cloud ru-central1
- Collect consent before any data processing (onboarding flow)
- Implement right-to-delete in settings: cascade delete all user data
- No cross-border data transfer
- Financial data: AES-256 at rest

### 10. AI Safety

- ALL AI responses must be followed by disclaimer:
  «Это информационный сервис, не финансовый советник»
- Moderate LLM output for offensive content (retry up to 2 times)
- Never pass full user financial history to LLM — only aggregated summaries
- Log all LLM calls for audit (without PII)

## Known Security Vulnerabilities to Avoid

- SQL injection via string concatenation (use Prisma always)
- JWT algorithm confusion (always specify `HS256` explicitly)
- BNPL referral self-referral (validate: referredBy ≠ userId)
- Payment webhook replay attacks (idempotency by payment_id)
- CSV injection (sanitize cell values before storage)

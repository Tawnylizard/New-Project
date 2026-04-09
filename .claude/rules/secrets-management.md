# Secrets Management — Клёво

## Storage Rules

### Development
- Use `.env` file (must be in `.gitignore`)
- Never commit `.env`, `.env.*`, `*.key`, `*.pem`

### Production
- ALL secrets in **Yandex Lockbox** — never in environment variables inline
- Access via Yandex Cloud SDK at runtime

## Required .gitignore Entries

```
.env
.env.*
*.key
*.pem
secrets/
```

## Secret Inventory

| Secret | Dev | Prod |
|--------|-----|------|
| `TELEGRAM_BOT_TOKEN` | `.env` | Yandex Lockbox |
| `JWT_SECRET` | `.env` | Yandex Lockbox |
| `YANDEX_GPT_API_KEY` | `.env` | Yandex Lockbox |
| `GIGACHAT_API_KEY` | `.env` | Yandex Lockbox |
| `YUKASSA_SHOP_ID` | `.env` | Yandex Lockbox |
| `YUKASSA_SECRET_KEY` | `.env` | Yandex Lockbox |
| `DATABASE_URL` | `.env` | Yandex Lockbox |
| `REDIS_URL` | `.env` | Yandex Lockbox |
| `YANDEX_S3_ACCESS_KEY` | `.env` | Yandex Lockbox |
| `YANDEX_S3_SECRET_KEY` | `.env` | Yandex Lockbox |

## API Key Usage Rules

1. **Never hardcode** API keys in source code
2. **Never log** secrets, tokens, or keys (even partial)
3. **Always use** typed service classes — never raw `fetch` with inline keys
4. **Rotate** if accidentally committed: revoke immediately, create new, update Lockbox

## External API Security

### YandexGPT / GigaChat
- Keys read from env at service initialization, not per-request
- Circuit breaker pattern: timeout 5s → fallback → cached
- Never pass raw user PII to LLM — use aggregated summaries only
- Log all LLM calls for audit (without PII)

### ЮKassa
- Validate webhook signature BEFORE processing any payment
- Check `payment_id` idempotency to prevent double-charges
- Store `YUKASSA_SECRET_KEY` only server-side, never in frontend

### Telegram Bot Token
- Used only in HMAC-SHA256 initData validation
- Never exposed to frontend
- Bot token is the KEY for `SHA256(BOT_TOKEN)` HMAC computation

## .env.example Template

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# JWT
JWT_SECRET=your_jwt_secret_here_min_32_chars

# YandexGPT
YANDEX_GPT_API_KEY=your_yandex_gpt_key
YANDEX_GPT_FOLDER_ID=your_folder_id

# GigaChat (fallback)
GIGACHAT_API_KEY=your_gigachat_key

# ЮKassa
YUKASSA_SHOP_ID=your_shop_id
YUKASSA_SECRET_KEY=your_secret_key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/klyovo

# Redis
REDIS_URL=redis://localhost:6379

# Yandex Object Storage
YANDEX_S3_BUCKET=klyovo-uploads
YANDEX_S3_ACCESS_KEY=your_access_key
YANDEX_S3_SECRET_KEY=your_secret_key
YANDEX_S3_ENDPOINT=https://storage.yandexcloud.net
```

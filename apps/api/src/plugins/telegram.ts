import crypto from 'node:crypto'

// Mirrors INIT_DATA_MAX_AGE_SECONDS from @klyovo/shared — 24 hours
const INIT_DATA_MAX_AGE_SECONDS = 86400

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

export interface ParsedInitData {
  user: TelegramUser
  authDate: number
  hash: string
}

export function validateTelegramInitData(initData: string): ParsedInitData {
  const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN']
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set')

  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) {
    const err = new Error('Авторизация не удалась') as Error & { statusCode: number; code: string }
    err.statusCode = 401
    err.code = 'INVALID_INIT_DATA'
    throw err
  }

  // Build data_check_string
  params.delete('hash')
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // HMAC-SHA256(data_check_string, SHA256(BOT_TOKEN))
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (computedHash !== receivedHash) {
    const err = new Error('Авторизация не удалась') as Error & { statusCode: number; code: string }
    err.statusCode = 401
    err.code = 'INVALID_INIT_DATA'
    throw err
  }

  const authDateStr = params.get('auth_date')
  const authDate = Number(authDateStr)
  const nowSec = Math.floor(Date.now() / 1000)

  if (nowSec - authDate > INIT_DATA_MAX_AGE_SECONDS) {
    const err = new Error('Сессия истекла. Открой бота заново.') as Error & {
      statusCode: number
      code: string
    }
    err.statusCode = 401
    err.code = 'EXPIRED_INIT_DATA'
    throw err
  }

  const userStr = params.get('user')
  if (!userStr) {
    const err = new Error('Авторизация не удалась') as Error & { statusCode: number; code: string }
    err.statusCode = 401
    err.code = 'INVALID_INIT_DATA'
    throw err
  }

  const user = JSON.parse(userStr) as TelegramUser

  return { user, authDate, hash: receivedHash }
}

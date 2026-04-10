import crypto from 'node:crypto'
import { validateTelegramInitData } from './telegram.js'

const BOT_TOKEN = 'test_bot_token_1234567890'

function buildInitData(
  overrides: {
    userId?: number
    firstName?: string
    username?: string
    authDate?: number
    tamperHash?: boolean
    omitHash?: boolean
    omitUser?: boolean
  } = {}
): string {
  const {
    userId = 123456789,
    firstName = 'Тест',
    username = 'testuser',
    authDate = Math.floor(Date.now() / 1000) - 60, // 1 min ago — fresh
    tamperHash = false,
    omitHash = false,
    omitUser = false
  } = overrides

  const params: Record<string, string> = {
    auth_date: String(authDate)
  }

  if (!omitUser) {
    params['user'] = JSON.stringify({ id: userId, first_name: firstName, username })
  }

  // Build data_check_string (sorted, without hash)
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // Compute correct HMAC
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (omitHash) {
    return new URLSearchParams(params).toString()
  }

  params['hash'] = tamperHash ? 'deadbeef'.repeat(8) : hash
  return new URLSearchParams(params).toString()
}

describe('validateTelegramInitData', () => {
  beforeEach(() => {
    process.env['TELEGRAM_BOT_TOKEN'] = BOT_TOKEN
  })

  afterEach(() => {
    delete process.env['TELEGRAM_BOT_TOKEN']
  })

  it('accepts valid initData and returns parsed user', () => {
    const initData = buildInitData({ userId: 42, firstName: 'Иван', username: 'ivan_test' })
    const result = validateTelegramInitData(initData)

    expect(result.user.id).toBe(42)
    expect(result.user.first_name).toBe('Иван')
    expect(result.user.username).toBe('ivan_test')
    expect(result.authDate).toBeGreaterThan(0)
  })

  it('rejects initData with tampered hash (INVALID_INIT_DATA)', () => {
    const initData = buildInitData({ tamperHash: true })
    expect(() => validateTelegramInitData(initData)).toThrow()
    try {
      validateTelegramInitData(initData)
    } catch (e) {
      const err = e as { code: string; statusCode: number }
      expect(err.code).toBe('INVALID_INIT_DATA')
      expect(err.statusCode).toBe(401)
    }
  })

  it('rejects initData with missing hash (INVALID_INIT_DATA)', () => {
    const initData = buildInitData({ omitHash: true })
    expect(() => validateTelegramInitData(initData)).toThrow()
    try {
      validateTelegramInitData(initData)
    } catch (e) {
      const err = e as { code: string }
      expect(err.code).toBe('INVALID_INIT_DATA')
    }
  })

  it('rejects expired initData older than 86400s (EXPIRED_INIT_DATA)', () => {
    const staleDate = Math.floor(Date.now() / 1000) - 90000 // 25 hours ago
    const initData = buildInitData({ authDate: staleDate })
    expect(() => validateTelegramInitData(initData)).toThrow()
    try {
      validateTelegramInitData(initData)
    } catch (e) {
      const err = e as { code: string; statusCode: number }
      expect(err.code).toBe('EXPIRED_INIT_DATA')
      expect(err.statusCode).toBe(401)
    }
  })

  it('rejects initData with missing user field (INVALID_INIT_DATA)', () => {
    const initData = buildInitData({ omitUser: true })
    expect(() => validateTelegramInitData(initData)).toThrow()
    try {
      validateTelegramInitData(initData)
    } catch (e) {
      const err = e as { code: string }
      expect(err.code).toBe('INVALID_INIT_DATA')
    }
  })

  it('throws if TELEGRAM_BOT_TOKEN is not set', () => {
    delete process.env['TELEGRAM_BOT_TOKEN']
    const initData = buildInitData()
    expect(() => validateTelegramInitData(initData)).toThrow('TELEGRAM_BOT_TOKEN is not set')
  })

  it('accepts initData with auth_date exactly at boundary (86399s ago)', () => {
    const freshDate = Math.floor(Date.now() / 1000) - 86399
    const initData = buildInitData({ authDate: freshDate })
    expect(() => validateTelegramInitData(initData)).not.toThrow()
  })

  it('handles user without optional fields (last_name, username)', () => {
    const params: Record<string, string> = {
      auth_date: String(Math.floor(Date.now() / 1000) - 60),
      user: JSON.stringify({ id: 99, first_name: 'Аноним' })
    }
    const dataCheckString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
    const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
    params['hash'] = hash
    const initData = new URLSearchParams(params).toString()

    const result = validateTelegramInitData(initData)
    expect(result.user.username).toBeUndefined()
    expect(result.user.last_name).toBeUndefined()
    expect(result.user.first_name).toBe('Аноним')
  })
})

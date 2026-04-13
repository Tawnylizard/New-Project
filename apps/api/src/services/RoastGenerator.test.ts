import { jest, describe, it, beforeEach, expect } from '@jest/globals'

// Mock Redis client
const mockRedis = {
  get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  set: jest.fn<() => Promise<string>>().mockResolvedValue('OK')
}

jest.unstable_mockModule('../plugins/rateLimit.js', () => ({
  rateLimitPlugin: async () => {},
  getRedisClient: () => mockRedis,
  default: async () => {}
}))

const YANDEX_RESPONSE = {
  result: { alternatives: [{ message: { text: 'Ты потратил ₽15000 на кофе. Это не кофе — это образ жизни банкрота.' } }] }
}

const GIGACHAT_RESPONSE = {
  choices: [{ message: { content: 'GigaChat: твои траты на такси — это просто ужас.' } }]
}

describe('RoastGenerator', () => {
  let RoastGenerator: Awaited<ReturnType<typeof import('./RoastGenerator.js')>>['RoastGenerator']

  const mockTransactions = Array.from({ length: 10 }, (_, i) => ({
    id: `txn-${i}`,
    userId: 'user-1',
    amountKopecks: 50000,
    merchantName: 'Яндекс Еда',
    merchantNormalized: 'яндекс еда',
    category: 'FOOD_CAFE',
    transactionDate: new Date(Date.now() - i * 86400000),
    source: 'CSV_SBER' as const,
    rawDescription: null,
    isBnpl: false,
    bnplService: null,
    createdAt: new Date()
  }))

  beforeEach(async () => {
    jest.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    process.env['YANDEX_GPT_API_KEY'] = 'test-key'
    process.env['YANDEX_GPT_FOLDER_ID'] = 'test-folder'
    process.env['GIGACHAT_API_KEY'] = 'gigachat-key'
    const mod = await import('./RoastGenerator.js')
    RoastGenerator = mod.RoastGenerator
  })

  it('returns YandexGPT response on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => YANDEX_RESPONSE
    } as unknown as Response)

    const result = await RoastGenerator.generate('user-1', mockTransactions, 'harsh')
    expect(result).toContain('₽15000')
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining('roast:user-1'),
      expect.any(String),
      'EX',
      3600
    )
  })

  it('falls back to GigaChat when YandexGPT fails', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('YandexGPT timeout'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => GIGACHAT_RESPONSE
      } as unknown as Response)

    const result = await RoastGenerator.generate('user-1', mockTransactions, 'harsh')
    expect(result).toContain('GigaChat')
  })

  it('falls back to cached roast when both LLMs fail', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('all LLMs down'))

    const result = await RoastGenerator.generate('user-1', mockTransactions, 'harsh')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(10)
    // Should not cache the static fallback
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('returns cached value without calling LLMs', async () => {
    mockRedis.get.mockResolvedValue('Cached roast text')
    global.fetch = jest.fn()

    const result = await RoastGenerator.generate('user-1', mockTransactions, 'harsh')
    expect(result).toBe('Cached roast text')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('retries once if YandexGPT returns offensive content', async () => {
    const offensiveResponse = {
      result: { alternatives: [{ message: { text: 'Ты мудак и тратишь деньги неправильно.' } }] }
    }
    const cleanResponse = {
      result: { alternatives: [{ message: { text: 'Твои траты на доставку еды пугают.' } }] }
    }

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => offensiveResponse } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => cleanResponse } as unknown as Response)

    const result = await RoastGenerator.generate('user-1', mockTransactions, 'harsh')
    expect(result).toContain('доставку еды')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('truncates response at last sentence boundary if over 500 chars', async () => {
    const longText = 'Ты много тратишь. '.repeat(40) + 'Это точно!'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { alternatives: [{ message: { text: longText } }] }
      })
    } as unknown as Response)

    const result = await RoastGenerator.generate('user-1', mockTransactions, 'harsh')
    expect(result.length).toBeLessThanOrEqual(500)
    // Should end at a sentence boundary
    expect(result).toMatch(/[.!?]$/)
  })

  it('uses soft mode system prompt for soft mode', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => YANDEX_RESPONSE
    } as unknown as Response)

    await RoastGenerator.generate('user-1', mockTransactions, 'soft')

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0]![1]!['body'] as string)
    expect(callBody.messages[0].text).toContain('заботливый')
  })
})

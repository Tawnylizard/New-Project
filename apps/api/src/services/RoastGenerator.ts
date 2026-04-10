import type { Prisma } from '@klyovo/db'

type Transaction = Prisma.TransactionGetPayload<object>
import type { RoastMode } from '@klyovo/shared'
import { getRedisClient } from '../plugins/rateLimit.js'
import crypto from 'node:crypto'

const SYSTEM_PROMPT_HARSH = `Ты — Клёво, финансовый ИИ с характером. Ты говоришь правду о тратах пользователя — честно, с юмором, без жалости. Пиши по-русски, на «ты», неформально. Не оскорбляй, не матерись. Будь конкретным: используй реальные суммы из данных. Максимум 3 абзаца, без вводных фраз типа «Ок, смотрю твои траты».`

const SYSTEM_PROMPT_SOFT = `Ты — Клёво, заботливый финансовый помощник. Ты помогаешь пользователю понять свои траты — тепло, поддерживающе, но честно. Пиши по-русски, на «ты», дружески. Используй реальные цифры. Максимум 3 абзаца.`

const CACHED_FALLBACK_ROASTS = [
  'Привет! Наш AI-аналитик сейчас перегружен. Но вот что точно: ты явно тратишь деньги — это уже прогресс! Попробуй чуть позже для персонального разбора.',
  'AI временно занят другими финансовыми катастрофами. Но не переживай — твои траты никуда не убегут. Загляни через минуту.',
  'Сервис анализа временно недоступен. Пока можешь сам посмотреть на свои траты и подумать: а зачем?'
]

const OFFENSIVE_WORDS = [
  'мудак', 'идиот', 'тупой', 'дебил', 'урод', 'ублюдок', 'сволочь'
]

function buildUserPrompt(transactions: Transaction[], mode: RoastMode): string {
  const totalAmount = transactions.reduce((s, t) => s + t.amountKopecks, 0)
  const totalRub = (totalAmount / 100).toFixed(0)

  const categorySums = new Map<string, number>()
  for (const t of transactions) {
    categorySums.set(t.category, (categorySums.get(t.category) ?? 0) + t.amountKopecks)
  }

  const topCategories = Array.from(categorySums.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `${cat} ₽${(amt / 100).toFixed(0)}`)
    .join(', ')

  const bnplTotal = transactions.filter(t => t.isBnpl).reduce((s, t) => s + t.amountKopecks, 0)
  const bnplRub = (bnplTotal / 100).toFixed(0)

  const period = `${new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}`

  return `${period}. Всего потрачено: ₽${totalRub}.
Топ траты: ${topCategories}.
${bnplTotal > 0 ? `Активных BNPL-долгов: ₽${bnplRub}.` : ''}
Сгенерируй ${mode === 'harsh' ? 'жёсткий roast' : 'мягкий анализ'}.`
}

function containsOffensiveWords(text: string): boolean {
  const lower = text.toLowerCase()
  return OFFENSIVE_WORDS.some(word => lower.includes(word))
}

function truncateAtLastSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const truncated = text.slice(0, maxChars)
  const lastPeriod = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  )
  return lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1) : truncated
}

async function callYandexGPT(systemPrompt: string, userPrompt: string): Promise<string> {
  const API_KEY = process.env['YANDEX_GPT_API_KEY']
  const FOLDER_ID = process.env['YANDEX_GPT_FOLDER_ID']
  if (!API_KEY || !FOLDER_ID) throw new Error('YandexGPT not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${API_KEY}`,
          'Content-Type': 'application/json',
          'x-folder-id': FOLDER_ID
        },
        body: JSON.stringify({
          modelUri: `gpt://${FOLDER_ID}/yandexgpt-pro`,
          completionOptions: { temperature: 0.85, maxTokens: '300' },
          messages: [
            { role: 'system', text: systemPrompt },
            { role: 'user', text: userPrompt }
          ]
        }),
        signal: controller.signal
      }
    )

    if (!response.ok) throw new Error(`YandexGPT error: ${response.status}`)

    const data = await response.json() as {
      result: { alternatives: Array<{ message: { text: string } }> }
    }

    const text = data.result.alternatives[0]?.message?.text
    if (!text) throw new Error('Empty YandexGPT response')
    return text
  } finally {
    clearTimeout(timeout)
  }
}

async function callGigaChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const API_KEY = process.env['GIGACHAT_API_KEY']
  if (!API_KEY) throw new Error('GigaChat not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'GigaChat-Pro',
        temperature: 0.85,
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    })

    if (!response.ok) throw new Error(`GigaChat error: ${response.status}`)

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }

    const text = data.choices[0]?.message?.content
    if (!text) throw new Error('Empty GigaChat response')
    return text
  } finally {
    clearTimeout(timeout)
  }
}

export class RoastGenerator {
  static async generate(
    userId: string,
    transactions: Transaction[],
    mode: RoastMode
  ): Promise<string> {
    const redis = getRedisClient()

    // Cache key based on userId + month + top categories
    const categorySums = new Map<string, number>()
    for (const t of transactions) {
      categorySums.set(t.category, (categorySums.get(t.category) ?? 0) + t.amountKopecks)
    }
    const topCats = Array.from(categorySums.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c)
      .join(',')

    const now = new Date()
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`
    const cacheKey = `roast:${userId}:${monthKey}:${mode}:${crypto.createHash('md5').update(topCats).digest('hex').slice(0, 8)}`

    const cached = await redis.get(cacheKey)
    if (cached) return cached

    const systemPrompt = mode === 'harsh' ? SYSTEM_PROMPT_HARSH : SYSTEM_PROMPT_SOFT
    const userPrompt = buildUserPrompt(transactions, mode)

    let roastText: string

    try {
      roastText = await callYandexGPT(systemPrompt, userPrompt)
    } catch {
      try {
        roastText = await callGigaChat(systemPrompt, userPrompt)
      } catch {
        const idx = Math.floor(Math.random() * CACHED_FALLBACK_ROASTS.length)
        roastText = CACHED_FALLBACK_ROASTS[idx] ?? CACHED_FALLBACK_ROASTS[0] ?? ''
        return roastText
      }
    }

    // Content moderation — max 2 retries
    for (let attempt = 0; attempt < 2 && containsOffensiveWords(roastText); attempt++) {
      try {
        roastText = await callYandexGPT(systemPrompt, userPrompt)
      } catch {
        break
      }
    }

    roastText = truncateAtLastSentence(roastText, 500)

    await redis.set(cacheKey, roastText, 'EX', 3600)

    return roastText
  }
}

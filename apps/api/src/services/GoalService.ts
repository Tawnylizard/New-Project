import { prisma } from '@klyovo/db'
import { getRedisClient } from '../plugins/rateLimit.js'
import crypto from 'node:crypto'

type SpendingByCategory = Record<string, number>

interface SpendingSummary {
  totalKopecks: number
  byCategory: SpendingByCategory
}

const CACHED_FALLBACK_ADVICE: Record<string, string> = {
  SAVINGS: 'Попробуй откладывать фиксированную сумму сразу после получения зарплаты — до того, как потратишь. Даже ₽500 в неделю дадут ₽26 000 за год.',
  EMERGENCY_FUND: 'Подушка безопасности — это 3–6 месячных расходов. Начни с малого: отложи ₽1 000 прямо сейчас, потом сделай это привычкой.',
  VACATION: 'Раздели сумму на недели до отъезда — будет понятнее, сколько откладывать в неделю. Сократи кофе и доставку еды — легко экономишь ₽3 000–5 000 в месяц.',
  GADGET: 'Подожди две недели перед покупкой гаджета — 80% импульсных желаний проходят. Если желание осталось, копи целенаправленно.',
  EDUCATION: 'Инвестиции в себя — самые выгодные. Откажись от одной подписки-паразита и направь деньги на обучение.',
  HOUSING: 'Ипотечный первый взнос — серьёзная цель. Автоматизируй отчисления: ставь автоперевод в день зарплаты.',
  OTHER: 'Разбей большую цель на milestone-ы по 25%. Каждый этап — маленькая победа, которая мотивирует продолжать.'
}

const DISCLAIMER = '\n\n_Это информационный сервис, не финансовый советник._'

async function getSpendingSummary(userId: string): Promise<SpendingSummary> {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const transactions = await prisma.transaction.findMany({
    where: { userId, transactionDate: { gte: since } },
    select: { amountKopecks: true, category: true }
  })

  const byCategory: SpendingByCategory = {}
  let totalKopecks = 0

  for (const tx of transactions) {
    totalKopecks += tx.amountKopecks
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amountKopecks
  }

  return { totalKopecks, byCategory }
}

function buildAdvicePrompt(params: {
  goalName: string
  targetRub: number
  remainingRub: number
  daysRemaining: number | null
  spending: SpendingSummary
}): { system: string; user: string } {
  const { goalName, targetRub, remainingRub, daysRemaining, spending } = params

  const system = 'Ты — Клёво, финансовый AI. Дай конкретный совет, как пользователь может сократить траты, чтобы достичь своей финансовой цели быстрее. Пиши по-русски, на «ты», кратко (3–5 предложений), с реальными суммами. Не пиши вводных фраз.'

  const categoryLines = Object.entries(spending.byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, amt]) => `  - ${cat}: ₽${(amt / 100).toFixed(0)}`)
    .join('\n')

  const deadlineLine = daysRemaining !== null
    ? `Осталось ${daysRemaining} дней до дедлайна.`
    : 'Дедлайн не задан.'

  const user = `Цель: «${goalName}». Нужно накопить ещё ₽${remainingRub.toFixed(0)} (из ₽${targetRub.toFixed(0)} итого).
${deadlineLine}
Траты за последние 30 дней:
  - Всего: ₽${(spending.totalKopecks / 100).toFixed(0)}
${categoryLines}
Где конкретно срезать, чтобы достичь цели быстрее?`

  return { system, user }
}

async function callYandexGPT(system: string, user: string): Promise<string> {
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
          Authorization: `Api-Key ${API_KEY}`,
          'Content-Type': 'application/json',
          'x-folder-id': FOLDER_ID
        },
        body: JSON.stringify({
          modelUri: `gpt://${FOLDER_ID}/yandexgpt-pro`,
          completionOptions: { temperature: 0.7, maxTokens: '250' },
          messages: [
            { role: 'system', text: system },
            { role: 'user', text: user }
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

async function callGigaChat(system: string, user: string): Promise<string> {
  const API_KEY = process.env['GIGACHAT_API_KEY']
  if (!API_KEY) throw new Error('GigaChat not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'GigaChat-Pro',
        temperature: 0.7,
        max_tokens: 250,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
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

function isPlausible(text: string): boolean {
  return text.length >= 50 && text.length <= 2000
}

export class GoalService {
  static async create(params: {
    userId: string
    name: string
    category: string
    targetAmountKopecks: number
    currentAmountKopecks: number
    deadline: Date | null
    isPlusPlan: boolean
  }) {
    const { userId, name, category, targetAmountKopecks, currentAmountKopecks, deadline, isPlusPlan } = params

    if (!isPlusPlan) {
      const activeCount = await prisma.financialGoal.count({
        where: { userId, status: 'ACTIVE' }
      })
      if (activeCount >= 1) {
        const err = new Error('FREE план: максимум 1 активная цель. Обновись до PLUS.')
        Object.assign(err, { statusCode: 403, code: 'GOAL_LIMIT_REACHED' })
        throw err
      }
    }

    const status = currentAmountKopecks >= targetAmountKopecks ? 'COMPLETED' : 'ACTIVE'

    return prisma.financialGoal.create({
      data: {
        userId,
        name,
        category: category as never,
        targetAmountKopecks,
        currentAmountKopecks,
        deadline,
        status: status as never
      }
    })
  }

  static async list(userId: string, statusFilter?: string) {
    return prisma.financialGoal.findMany({
      where: {
        userId,
        ...(statusFilter ? { status: statusFilter as never } : {})
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async update(params: {
    userId: string
    goalId: string
    name?: string
    currentAmountKopecks?: number
    deadline?: Date | null
    status?: string
  }) {
    const { userId, goalId, name, currentAmountKopecks, deadline, status } = params

    const goal = await prisma.financialGoal.findFirst({
      where: { id: goalId, userId }
    })

    if (!goal) {
      const err = new Error('Цель не найдена')
      Object.assign(err, { statusCode: 404, code: 'GOAL_NOT_FOUND' })
      throw err
    }

    if (goal.status === 'ABANDONED' && status !== 'ABANDONED') {
      const err = new Error('Нельзя обновить архивированную цель')
      Object.assign(err, { statusCode: 400, code: 'GOAL_ARCHIVED' })
      throw err
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData['name'] = name
    if (deadline !== undefined) updateData['deadline'] = deadline
    if (status !== undefined) updateData['status'] = status

    if (currentAmountKopecks !== undefined) {
      updateData['currentAmountKopecks'] = currentAmountKopecks
      const newTarget = goal.targetAmountKopecks
      if (currentAmountKopecks >= newTarget && goal.status === 'ACTIVE') {
        updateData['status'] = 'COMPLETED'
      }
    }

    return prisma.financialGoal.update({
      where: { id: goalId },
      data: updateData as never
    })
  }

  static async delete(userId: string, goalId: string): Promise<void> {
    const goal = await prisma.financialGoal.findFirst({
      where: { id: goalId, userId }
    })

    if (!goal) {
      const err = new Error('Цель не найдена')
      Object.assign(err, { statusCode: 404, code: 'GOAL_NOT_FOUND' })
      throw err
    }

    await prisma.financialGoal.delete({ where: { id: goalId } })
  }

  static async generateAdvice(userId: string, goalId: string): Promise<{ advice: string; generatedAt: string }> {
    const goal = await prisma.financialGoal.findFirst({
      where: { id: goalId, userId, status: 'ACTIVE' }
    })

    if (!goal) {
      const err = new Error('Активная цель не найдена')
      Object.assign(err, { statusCode: 404, code: 'GOAL_NOT_FOUND' })
      throw err
    }

    const spending = await getSpendingSummary(userId)

    const spendingHash = crypto
      .createHash('md5')
      .update(JSON.stringify(spending.byCategory))
      .digest('hex')
      .slice(0, 8)

    const cacheKey = `goal_advice:${goalId}:${spendingHash}`
    const redis = getRedisClient()
    const cached = await redis.get(cacheKey)

    if (cached) {
      const parsed = JSON.parse(cached) as { advice: string; generatedAt: string }
      return parsed
    }

    const remainingKopecks = Math.max(0, goal.targetAmountKopecks - goal.currentAmountKopecks)

    const daysRemaining = goal.deadline
      ? Math.ceil((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

    const prompt = buildAdvicePrompt({
      goalName: goal.name,
      targetRub: goal.targetAmountKopecks / 100,
      remainingRub: remainingKopecks / 100,
      daysRemaining,
      spending
    })

    let advice: string
    const category = goal.category as string

    try {
      advice = await callYandexGPT(prompt.system, prompt.user)
      if (!isPlausible(advice)) {
        advice = await callYandexGPT(prompt.system, prompt.user)
      }
    } catch {
      try {
        advice = await callGigaChat(prompt.system, prompt.user)
      } catch {
        advice = CACHED_FALLBACK_ADVICE[category] ?? CACHED_FALLBACK_ADVICE['OTHER'] ?? ''
      }
    }

    if (!isPlausible(advice)) {
      advice = CACHED_FALLBACK_ADVICE[category] ?? CACHED_FALLBACK_ADVICE['OTHER'] ?? ''
    }

    advice = advice + DISCLAIMER

    const generatedAt = new Date().toISOString()
    const cacheValue = JSON.stringify({ advice, generatedAt })

    await redis.set(cacheKey, cacheValue, 'EX', 7200)

    await prisma.financialGoal.update({
      where: { id: goalId },
      data: { aiAdvice: advice, aiAdviceGeneratedAt: new Date() }
    })

    return { advice, generatedAt }
  }
}

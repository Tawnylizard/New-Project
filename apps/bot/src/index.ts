import Fastify from 'fastify'
import { Bot, webhookCallback } from 'grammy'
import { prisma } from '@klyovo/db'

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN']
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is required')
  process.exit(1)
}

const bot = new Bot(BOT_TOKEN)
const BOT_USERNAME = process.env['TELEGRAM_BOT_USERNAME'] ?? 'klyovobot'
const TMA_URL = process.env['TMA_URL'] ?? `https://t.me/${BOT_USERNAME}/app`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateName(name: string, max = 20): string {
  return name.length > max ? name.slice(0, max) + '…' : name
}

function bankSelectKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🟢 Сбербанк', callback_data: 'bank:sber' },
        { text: '🟡 Т-Банк', callback_data: 'bank:tbank' }
      ],
      [{ text: '🏦 Другой банк', callback_data: 'bank:other' }]
    ]
  }
}

function openAppKeyboard(label = '🔥 Открыть Клёво') {
  return {
    inline_keyboard: [[{ text: label, web_app: { url: TMA_URL } }]]
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.command('start', async ctx => {
  const startParam = ctx.match
  const firstName = truncateName(ctx.from?.first_name ?? 'друг')

  // Handle referral deeplink
  if (startParam?.startsWith('ref_')) {
    const referralCode = startParam.slice(4)
    const referrer = await prisma.user.findFirst({ where: { referralCode } })
    if (referrer && ctx.from?.id) {
      const existingUser = await prisma.user.findFirst({
        where: { telegramId: BigInt(ctx.from.id) }
      })
      if (!existingUser) {
        console.info(`Referral from ${referralCode} for user ${ctx.from.id}`)
      }
    }
  }

  // Handle roast share deeplink
  if (startParam?.startsWith('roast_')) {
    await ctx.reply(
      `🔥 ${firstName}, посмотри на этот roast — и загляни к себе!\n\nОткрой Клёво и проверь свои траты:`,
      { reply_markup: openAppKeyboard('🚀 Открыть Клёво') }
    )
    return
  }

  // Onboarding: step 1 — welcome + bank select
  await ctx.reply(
    `Привет, ${firstName}! 👋\n\n` +
    `Я — Клёво, финансовый ИИ с характером. Загрузи выписку из банка — разберу твои траты честно и с юмором.\n\n` +
    `С какого банка у тебя карта?`,
    { reply_markup: bankSelectKeyboard() }
  )
})

bot.command('how', async ctx => {
  await ctx.reply(
    'С какого банка скачать выписку?',
    { reply_markup: bankSelectKeyboard() }
  )
})

bot.command('banks', async ctx => {
  await ctx.reply(
    'Поддерживаемые банки:\n\n' +
    '✅ Сбербанк — CSV выписка\n' +
    '✅ Т-Банк — Excel (.xlsx) выписка\n' +
    '🔜 Альфа-Банк — скоро\n' +
    '🔜 ВТБ — скоро\n' +
    '🔜 Газпромбанк — скоро',
    { reply_markup: openAppKeyboard('📊 Открыть Клёво') }
  )
})

bot.command('help', async ctx => {
  await ctx.reply(
    'Команды Клёво:\n\n' +
    '/start — начать работу\n' +
    '/how — как скачать выписку из банка\n' +
    '/banks — список поддерживаемых банков\n' +
    '/help — эта справка',
    { reply_markup: openAppKeyboard('📊 Открыть Клёво') }
  )
})

// ─── Callback: bank selection ─────────────────────────────────────────────────

bot.callbackQuery('bank:sber', async ctx => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    'Как скачать выписку из Сбербанка:\n\n' +
    '1. Откройте Сбербанк Онлайн\n' +
    '2. Выберите карту или счёт\n' +
    '3. Нажмите «История операций»\n' +
    '4. Нажмите значок ⬇️ (экспорт) в правом верхнем углу\n' +
    '5. Выберите формат CSV\n' +
    '6. Сохраните файл\n\n' +
    'Готово! Теперь загрузи файл в Клёво 👇',
    { reply_markup: openAppKeyboard() }
  )
})

bot.callbackQuery('bank:tbank', async ctx => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    'Как скачать выписку из Т-Банка:\n\n' +
    '1. Откройте приложение Т-Банк\n' +
    '2. Перейдите на вкладку «Счета»\n' +
    '3. Выберите нужную карту\n' +
    '4. Нажмите «Выписка»\n' +
    '5. Выберите период и формат Excel (.xlsx)\n' +
    '6. Сохраните файл\n\n' +
    'Готово! Теперь загрузи файл в Клёво 👇',
    { reply_markup: openAppKeyboard() }
  )
})

bot.callbackQuery('bank:other', async ctx => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    'Пока поддерживаем:\n' +
    '✅ Сбербанк (CSV)\n' +
    '✅ Т-Банк (Excel)\n\n' +
    'Скоро добавим Альфа-Банк и ВТБ.\n\n' +
    'Если есть карта Сбера или Т-Банка — загружай выписку оттуда!',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🟢 Сбербанк', callback_data: 'bank:sber' },
            { text: '🟡 Т-Банк', callback_data: 'bank:tbank' }
          ]
        ]
      }
    }
  )
})

// ─── Bot commands menu ────────────────────────────────────────────────────────

async function registerCommands() {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Начать работу с Клёво' },
    { command: 'how', description: 'Как скачать выписку из банка' },
    { command: 'banks', description: 'Список поддерживаемых банков' },
    { command: 'help', description: 'Помощь' }
  ])
}

// ─── Webhook server ───────────────────────────────────────────────────────────

const app = Fastify({ logger: { level: 'info' } })
const PORT = Number(process.env['PORT'] ?? 3001)

app.post(`/webhook/${BOT_TOKEN}`, webhookCallback(bot, 'fastify'))
app.get('/health', async () => ({ status: 'ok' }))

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(async () => {
    console.info(`Bot webhook server listening on port ${PORT}`)
    await registerCommands()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

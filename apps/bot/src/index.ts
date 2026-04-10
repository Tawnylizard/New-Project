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

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.command('start', async ctx => {
  const startParam = ctx.match
  const firstName = ctx.from?.first_name ?? 'друг'

  // Handle referral
  if (startParam?.startsWith('ref_')) {
    const referralCode = startParam.slice(4)
    const referrer = await prisma.user.findFirst({ where: { referralCode } })
    if (referrer && ctx.from?.id) {
      const existingUser = await prisma.user.findFirst({
        where: { telegramId: BigInt(ctx.from.id) }
      })
      if (!existingUser) {
        // Will be linked on first auth
        console.info(`Referral from ${referralCode} for user ${ctx.from.id}`)
      }
    }
  }

  // Handle roast share deeplink
  if (startParam?.startsWith('roast_')) {
    await ctx.reply(
      `🔥 ${firstName}, посмотри на этот roast — и загляни к себе!\n\n` +
        `Открой Клёво и проверь свои траты:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Открыть Клёво', web_app: { url: TMA_URL } }]
          ]
        }
      }
    )
    return
  }

  await ctx.reply(
    `Привет, ${firstName}! 👋\n\n` +
      `Я — Клёво, финансовый ИИ с характером. Разберу твои траты честно — без жалости и с юмором.\n\n` +
      `Открой приложение и загрузи выписку из банка 👇`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔥 Открыть Клёво', web_app: { url: TMA_URL } }]
        ]
      }
    }
  )
})

bot.command('help', async ctx => {
  await ctx.reply(
    `Команды Клёво:\n\n` +
      `/start — открыть приложение\n` +
      `/help — эта справка\n\n` +
      `Для анализа трат используй приложение 👆`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Открыть Клёво', web_app: { url: TMA_URL } }]
        ]
      }
    }
  )
})

// ─── Webhook server ───────────────────────────────────────────────────────────

const app = Fastify({ logger: { level: 'info' } })
const PORT = Number(process.env['PORT'] ?? 3001)

app.post(`/webhook/${BOT_TOKEN}`, webhookCallback(bot, 'fastify'))

app.get('/health', async () => ({ status: 'ok' }))

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    console.info(`Bot webhook server listening on port ${PORT}`)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

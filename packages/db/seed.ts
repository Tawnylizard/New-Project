import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  console.info('🌱 Seeding database...')

  // Dev user
  const user = await prisma.user.upsert({
    where: { telegramId: 123456789n },
    update: {},
    create: {
      telegramId: 123456789n,
      telegramUsername: 'dev_user',
      displayName: 'Дев Юзер',
      plan: 'FREE',
      referralCode: 'DEV00001',
      consentGivenAt: new Date()
    }
  })

  console.info(`✅ User created: ${user.id}`)

  // Sample transactions
  const transactions = [
    { merchant: 'Яндекс Еда', category: 'FOOD_CAFE' as const, amount: 85000 },
    { merchant: 'Пятёрочка', category: 'GROCERIES' as const, amount: 230000 },
    { merchant: 'Wildberries', category: 'MARKETPLACE' as const, amount: 459000 },
    { merchant: 'Яндекс Такси', category: 'TRANSPORT' as const, amount: 45000 },
    { merchant: 'Яндекс Плюс', category: 'SUBSCRIPTIONS' as const, amount: 29900 },
    { merchant: 'Netflix', category: 'SUBSCRIPTIONS' as const, amount: 79900 },
    { merchant: 'Вкусвилл', category: 'GROCERIES' as const, amount: 135000 },
    { merchant: 'KFC', category: 'FOOD_CAFE' as const, amount: 67000 },
    { merchant: 'Ozon', category: 'MARKETPLACE' as const, amount: 320000 },
    { merchant: 'Самокат', category: 'FOOD_CAFE' as const, amount: 42000 }
  ]

  const now = new Date()
  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i]
    if (!txn) continue
    const date = new Date(now)
    date.setDate(date.getDate() - i * 3)

    await prisma.transaction.upsert({
      where: {
        userId_transactionDate_amountKopecks_merchantNormalized: {
          userId: user.id,
          transactionDate: date,
          amountKopecks: txn.amount,
          merchantNormalized: txn.merchant.toLowerCase()
        }
      },
      update: {},
      create: {
        userId: user.id,
        amountKopecks: txn.amount,
        merchantName: txn.merchant,
        merchantNormalized: txn.merchant.toLowerCase(),
        category: txn.category,
        transactionDate: date,
        source: 'MANUAL'
      }
    })
  }

  console.info(`✅ ${transactions.length} transactions created`)
  console.info('🎉 Seed complete!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

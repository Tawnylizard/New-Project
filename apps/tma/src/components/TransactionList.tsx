import type { Transaction, TransactionCategory } from '@klyovo/shared'

const CATEGORY_EMOJI: Record<TransactionCategory, string> = {
  FOOD_CAFE: '🍕',
  GROCERIES: '🛒',
  MARKETPLACE: '📦',
  TRANSPORT: '🚕',
  SUBSCRIPTIONS: '📱',
  ENTERTAINMENT: '🎭',
  HEALTH: '💊',
  CLOTHING: '👕',
  EDUCATION: '📚',
  OTHER: '💸'
}

interface TransactionListProps {
  transactions: Transaction[]
  limit?: number
}

export function TransactionList({ transactions, limit = 20 }: TransactionListProps): JSX.Element {
  const visible = transactions.slice(0, limit)

  if (visible.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-tg-hint text-sm">Нет транзакций</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-tg-text">Последние транзакции</p>
      {visible.map(txn => (
        <div key={txn.id} className="flex items-center gap-3 bg-tg-secondary rounded-xl p-3">
          <span className="text-xl">{CATEGORY_EMOJI[txn.category]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-tg-text truncate">{txn.merchantName}</p>
            <p className="text-xs text-tg-hint">
              {new Date(txn.transactionDate).toLocaleDateString('ru-RU')}
              {txn.isBnpl && ' · BNPL'}
            </p>
          </div>
          <p className="text-sm font-bold text-tg-text shrink-0">
            ₽{(txn.amountKopecks / 100).toFixed(0)}
          </p>
        </div>
      ))}
    </div>
  )
}

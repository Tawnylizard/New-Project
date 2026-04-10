import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { useAppStore } from '../store/useAppStore.js'
import { SpendingChart } from '../components/SpendingChart.js'
import { TransactionList } from '../components/TransactionList.js'
import type { Transaction } from '@klyovo/shared'

interface TransactionsResponse {
  transactions: Transaction[]
}

export function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const { user } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.get<TransactionsResponse>('/transactions').then(r => r.data)
  })

  const transactions = data?.transactions ?? []

  return (
    <div className="min-h-screen bg-tg-bg pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-tg-bg border-b border-tg-secondary px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-tg-hint">Привет,</p>
          <p className="font-bold text-tg-text">{user?.displayName ?? '...'}</p>
        </div>
        {user?.plan === 'FREE' && (
          <button
            onClick={() => navigate('/paywall')}
            className="bg-tg-button text-tg-button-text text-xs font-semibold px-3 py-1.5 rounded-xl"
          >
            Плюс
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Roast CTA */}
        <button
          onClick={() => navigate('/roast')}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 px-6 rounded-2xl text-lg flex items-center justify-center gap-2"
        >
          🔥 Жёсткий режим
        </button>

        {/* Spending chart */}
        {isLoading ? (
          <div className="h-48 bg-tg-secondary rounded-2xl animate-pulse" />
        ) : transactions.length > 0 ? (
          <SpendingChart transactions={transactions} />
        ) : (
          <div className="bg-tg-secondary rounded-2xl p-6 text-center space-y-3">
            <p className="text-4xl">📊</p>
            <p className="text-tg-text font-medium">Нет данных</p>
            <p className="text-tg-hint text-sm">Загрузи выписку чтобы увидеть анализ</p>
            <button
              onClick={() => navigate('/onboarding')}
              className="bg-tg-button text-tg-button-text font-semibold py-2 px-5 rounded-xl text-sm"
            >
              Загрузить CSV
            </button>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/subscriptions')}
            className="bg-tg-secondary rounded-2xl p-4 text-left"
          >
            <p className="text-2xl">🩸</p>
            <p className="text-sm font-medium text-tg-text mt-1">Подписки</p>
            <p className="text-xs text-tg-hint">паразиты</p>
          </button>
          <button
            onClick={() => navigate('/bnpl')}
            className="bg-tg-secondary rounded-2xl p-4 text-left"
          >
            <p className="text-2xl">💳</p>
            <p className="text-sm font-medium text-tg-text mt-1">BNPL</p>
            <p className="text-xs text-tg-hint">Долями, Сплит</p>
          </button>
        </div>

        {/* Transaction list */}
        <TransactionList transactions={transactions} />
      </div>
    </div>
  )
}

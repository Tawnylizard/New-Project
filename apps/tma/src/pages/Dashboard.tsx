import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { useAppStore } from '../store/useAppStore.js'
import { SpendingChart } from '../components/SpendingChart.js'
import { TransactionList } from '../components/TransactionList.js'
import type { AnalyticsSummaryResponse, AnalyticsPeriod, Transaction } from '@klyovo/shared'

interface TransactionsResponse {
  transactions: Transaction[]
}

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  month: 'Этот мес.',
  last_month: 'Прошлый',
  '3months': '3 месяца'
}

function formatAmount(kopecks: number): string {
  const rubles = kopecks / 100
  if (rubles >= 1_000_000) return `₽${(rubles / 1_000_000).toFixed(1)} млн`
  if (rubles >= 1_000) return `₽${(rubles / 1_000).toFixed(0)} тыс`
  return `₽${rubles.toFixed(0)}`
}

export function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const { user } = useAppStore()
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', period],
    queryFn: () =>
      apiClient
        .get<AnalyticsSummaryResponse>(`/analytics/summary?period=${period}`)
        .then(r => r.data)
  })

  const { data: txnData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () =>
      apiClient.get<TransactionsResponse>('/transactions').then(r => r.data)
  })

  const transactions = txnData?.transactions ?? []
  const hasNoTransactions = !analyticsLoading && analytics?.transactionCount === 0 && transactions.length === 0

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

        {/* Period selector */}
        <div className="flex gap-2">
          {(Object.keys(PERIOD_LABELS) as AnalyticsPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-secondary text-tg-hint'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Spending summary */}
        {analyticsLoading ? (
          <div className="h-20 bg-tg-secondary rounded-2xl animate-pulse" />
        ) : analytics && analytics.transactionCount > 0 ? (
          <div className="bg-tg-secondary rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-tg-hint mb-0.5">Потрачено</p>
              <p className="text-2xl font-bold text-tg-text">
                {formatAmount(analytics.totalKopecks)}
              </p>
            </div>
            {analytics.changePercent !== null && (
              <div
                className={`text-sm font-bold px-3 py-1.5 rounded-xl ${
                  analytics.changePercent <= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {analytics.changePercent > 0 ? '+' : ''}
                {analytics.changePercent}%
              </div>
            )}
          </div>
        ) : null}

        {/* Chart or empty state */}
        {analyticsLoading ? (
          <div className="h-48 bg-tg-secondary rounded-2xl animate-pulse" />
        ) : hasNoTransactions ? (
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
        ) : analytics && analytics.transactionCount === 0 ? (
          <div className="bg-tg-secondary rounded-2xl p-4 text-center">
            <p className="text-tg-hint text-sm">Нет транзакций за этот период</p>
          </div>
        ) : analytics ? (
          <SpendingChart topCategories={analytics.topCategories} totalKopecks={analytics.totalKopecks} />
        ) : null}

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

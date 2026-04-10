import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { Transaction } from '@klyovo/shared'

interface TransactionsResponse {
  transactions: Transaction[]
}

export function BNPL(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.get<TransactionsResponse>('/transactions').then(r => r.data)
  })

  const bnplTxns = (data?.transactions ?? []).filter(t => t.isBnpl)
  const bnplByService = bnplTxns.reduce<Record<string, number>>((acc, t) => {
    const service = t.bnplService ?? 'other'
    acc[service] = (acc[service] ?? 0) + t.amountKopecks
    return acc
  }, {})
  const totalBnpl = bnplTxns.reduce((s, t) => s + t.amountKopecks, 0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tg-bg p-4 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-24 bg-tg-secondary rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-tg-bg p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-tg-text">💳 BNPL-трекер</h1>
        <p className="text-sm text-tg-hint">Долями, Сплит, Подели</p>
      </div>

      {bnplTxns.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">🎉</p>
          <p className="text-tg-text font-medium">У тебя нет активных BNPL-платежей</p>
          <p className="text-tg-hint text-sm">Хорошо — жизнь без долей в долг</p>
        </div>
      ) : (
        <>
          {/* Total */}
          <div className="bg-orange-50 rounded-2xl p-4">
            <p className="text-sm text-orange-600 font-medium">Всего в BNPL</p>
            <p className="text-3xl font-bold text-orange-600">
              ₽{(totalBnpl / 100).toFixed(0)}
            </p>
          </div>

          {/* By service */}
          <div className="space-y-2">
            {Object.entries(bnplByService).map(([service, amount]) => (
              <div key={service} className="bg-tg-secondary rounded-xl p-3 flex justify-between">
                <p className="text-sm font-medium text-tg-text capitalize">{service}</p>
                <p className="text-sm font-bold text-tg-text">₽{(amount / 100).toFixed(0)}</p>
              </div>
            ))}
          </div>

          {/* Transactions */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-tg-text">Транзакции</p>
            {bnplTxns.slice(0, 10).map(t => (
              <div key={t.id} className="bg-tg-secondary rounded-xl p-3 flex justify-between">
                <div>
                  <p className="text-sm text-tg-text">{t.merchantName}</p>
                  <p className="text-xs text-tg-hint">
                    {new Date(t.transactionDate).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <p className="text-sm font-medium text-tg-text">
                  ₽{(t.amountKopecks / 100).toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

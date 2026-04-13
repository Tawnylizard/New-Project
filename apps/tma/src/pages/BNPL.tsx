import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { BnplListResponse } from '@klyovo/shared'
import { BnplCard } from '../components/BnplCard.js'
import { BnplTimeline } from '../components/BnplTimeline.js'

type Tab = 'obligations' | 'timeline'

export function BNPL(): JSX.Element {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('obligations')

  const { data, isLoading } = useQuery({
    queryKey: ['bnpl'],
    queryFn: () => apiClient.get<BnplListResponse>('/bnpl').then(r => r.data)
  })

  const scan = useMutation({
    mutationFn: () => apiClient.post('/bnpl/scan'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bnpl'] })
  })

  const dismiss = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'dismissed' | 'active' }) =>
      apiClient.patch(`/bnpl/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bnpl'] })
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tg-bg p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-tg-secondary rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const obligations = data?.obligations ?? []
  const summary = data?.summary
  const activeObligations = obligations.filter(o => o.status === 'active' || o.status === 'overdue')
  const hasAny = obligations.length > 0

  return (
    <div className="min-h-screen bg-tg-bg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-tg-text">💳 BNPL-трекер</h1>
          {summary && activeObligations.length > 0 && (
            <p className="text-sm text-tg-hint">
              Долг: ₽{(summary.totalDebtKopecks / 100).toFixed(0)}
              {summary.nextPaymentDate && (
                <> · следующий {new Date(summary.nextPaymentDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</>
              )}
            </p>
          )}
        </div>
        {hasAny && (
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="text-xs text-tg-hint border border-tg-secondary px-3 py-1.5 rounded-xl disabled:opacity-50"
          >
            {scan.isPending ? '...' : 'Обновить'}
          </button>
        )}
      </div>

      {scan.isError && (
        <p className="text-xs text-red-500">Не удалось запустить сканирование. Попробуй ещё раз.</p>
      )}

      {/* Empty state */}
      {!hasAny ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-4xl">🎉</p>
          <p className="text-tg-text font-medium">Рассрочек не найдено</p>
          <p className="text-tg-hint text-sm">Загрузи выписку за 2+ месяца и нажми «Найти»</p>
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="bg-tg-button text-tg-button-text font-medium px-6 py-3 rounded-2xl disabled:opacity-50"
          >
            {scan.isPending ? 'Ищем...' : 'Найти рассрочки'}
          </button>
        </div>
      ) : (
        <>
          {/* Overdue alert */}
          {summary && summary.overdueCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <p className="text-sm text-red-700 font-medium">
                {summary.overdueCount} просроченных платежей
              </p>
            </div>
          )}

          {/* Summary card */}
          {summary && activeObligations.length > 0 && (
            <div className="bg-orange-50 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-orange-700 font-medium">Всего осталось</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₽{(summary.totalDebtKopecks / 100).toFixed(0)}
                </p>
              </div>
              {summary.nextPaymentDate && (
                <p className="text-xs text-orange-600">
                  Ближайший платёж: ₽{(summary.nextPaymentAmount / 100).toFixed(0)} —{' '}
                  {new Date(summary.nextPaymentDate).toLocaleDateString('ru-RU', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </p>
              )}
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex bg-tg-secondary rounded-2xl p-1 gap-1">
            <button
              onClick={() => setTab('obligations')}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                tab === 'obligations'
                  ? 'bg-tg-bg text-tg-text shadow-sm'
                  : 'text-tg-hint'
              }`}
            >
              Рассрочки
            </button>
            <button
              onClick={() => setTab('timeline')}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                tab === 'timeline'
                  ? 'bg-tg-bg text-tg-text shadow-sm'
                  : 'text-tg-hint'
              }`}
            >
              Timeline
            </button>
          </div>

          {/* Tab content */}
          {tab === 'obligations' && (
            <div className="space-y-3">
              {obligations.map(ob => (
                <BnplCard
                  key={ob.id}
                  obligation={ob}
                  onDismiss={id => dismiss.mutate({ id, status: 'dismissed' })}
                  onRestore={id => dismiss.mutate({ id, status: 'active' })}
                  isPending={dismiss.isPending}
                />
              ))}
            </div>
          )}

          {tab === 'timeline' && (
            <BnplTimeline obligations={activeObligations} />
          )}
        </>
      )}
    </div>
  )
}

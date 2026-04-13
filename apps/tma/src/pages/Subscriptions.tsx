import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { SubscriptionListResponse } from '@klyovo/shared'

export function Subscriptions(): JSX.Element {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () =>
      apiClient.get<SubscriptionListResponse>('/subscriptions').then(r => r.data)
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/subscriptions/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] })
  })

  const scan = useMutation({
    mutationFn: () => apiClient.post('/subscriptions/scan'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] })
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tg-bg p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-tg-secondary rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const subs = data?.subscriptions ?? []
  const activeSubs = subs.filter(s => s.status === 'active')

  return (
    <div className="min-h-screen bg-tg-bg p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-tg-text">🩸 Подписки-паразиты</h1>
        {activeSubs.length > 0 && (
          <p className="text-sm text-tg-hint">
            ₽{((data?.totalMonthly ?? 0) / 100).toFixed(0)}/мес ·{' '}
            ₽{((data?.totalAnnual ?? 0) / 100).toFixed(0)}/год
          </p>
        )}
      </div>

      {subs.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-4xl">🔍</p>
          <p className="text-tg-text font-medium">Подписки не найдены</p>
          <p className="text-tg-hint text-sm">Загрузи выписку за 2+ месяца, потом нажми «Найти»</p>
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="bg-tg-button text-tg-button-text font-medium px-6 py-3 rounded-2xl disabled:opacity-50"
          >
            {scan.isPending ? 'Ищем...' : 'Найти подписки'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(sub => (
            <div key={sub.id} className={`bg-tg-secondary rounded-2xl p-4 space-y-2 ${sub.status !== 'active' ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-tg-text capitalize">{sub.merchantName}</p>
                <p className="font-bold text-tg-text">
                  ₽{(sub.estimatedAmount / 100).toFixed(0)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-tg-hint">
                  каждые {sub.frequencyDays} дн · {sub.occurrences}× обнаружена
                </p>
                <p className="text-xs text-orange-500">
                  ₽{(sub.annualCost / 100).toFixed(0)}/год
                </p>
              </div>
              {sub.status === 'active' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus.mutate({ id: sub.id, status: 'cancelled' })}
                    className="flex-1 bg-red-100 text-red-600 text-xs font-medium py-2 rounded-xl"
                  >
                    Это паразит
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ id: sub.id, status: 'ignored' })}
                    className="flex-1 bg-tg-bg text-tg-hint text-xs font-medium py-2 rounded-xl border border-tg-secondary"
                  >
                    Игнорировать
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

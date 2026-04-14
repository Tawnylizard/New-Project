import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { GetStreaksResponse } from '@klyovo/shared'

export function StreakWidget(): JSX.Element {
  const { data } = useQuery({
    queryKey: ['streaks'],
    queryFn: () => apiClient.get<GetStreaksResponse>('/streaks').then(r => r.data),
    staleTime: 5 * 60 * 1000 // 5 min
  })

  const importStreak = data?.importStreak.current ?? 0
  const spendingStreak = data?.spendingStreak.current ?? 0

  if (importStreak === 0 && spendingStreak === 0) {
    return (
      <div className="bg-tg-secondary/30 rounded-2xl p-3 flex items-center gap-2">
        <span className="text-lg">💡</span>
        <span className="text-tg-hint text-sm">Начни стрик — импортируй первую выписку</span>
      </div>
    )
  }

  return (
    <div className="bg-tg-secondary/30 rounded-2xl p-3 flex items-center gap-4">
      {importStreak > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xl">🔥</span>
          <div>
            <div className="text-tg-text font-bold text-sm leading-none">{importStreak}</div>
            <div className="text-tg-hint text-xs">{importStreak === 1 ? 'день' : importStreak < 5 ? 'дня' : 'дней'}</div>
          </div>
        </div>
      )}
      {importStreak > 0 && spendingStreak > 0 && (
        <div className="w-px h-8 bg-tg-secondary" />
      )}
      {spendingStreak > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xl">📉</span>
          <div>
            <div className="text-tg-text font-bold text-sm leading-none">{spendingStreak}</div>
            <div className="text-tg-hint text-xs">{spendingStreak === 1 ? 'неделя' : spendingStreak < 5 ? 'недели' : 'недель'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { AchievementCard } from '../components/AchievementCard.js'
import { StreakWidget } from '../components/StreakWidget.js'
import type { GetAchievementsResponse } from '@klyovo/shared'

export function Achievements(): JSX.Element {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => apiClient.get<GetAchievementsResponse>('/achievements').then(r => r.data)
  })

  const unlocked = data?.unlocked ?? []
  const locked = data?.locked ?? []
  const total = unlocked.length + locked.length

  return (
    <div className="min-h-screen bg-tg-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-tg-bg border-b border-tg-secondary px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-tg-hint text-xl"
          >
            ←
          </button>
          <h1 className="text-tg-text font-bold text-lg">Ачивки</h1>
          <span className="ml-auto text-tg-hint text-sm">
            {unlocked.length}/{total}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Streak widget */}
        <StreakWidget />

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-tg-hint">Прогресс</span>
            <span className="text-tg-text font-medium">{unlocked.length} из {total}</span>
          </div>
          <div className="w-full bg-tg-secondary/30 rounded-full h-2">
            <div
              className="bg-tg-button rounded-full h-2 transition-all duration-500"
              style={{ width: total > 0 ? `${(unlocked.length / total) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-tg-hint text-center py-8">Загружаем...</div>
        ) : (
          <>
            {/* Unlocked */}
            {unlocked.length > 0 && (
              <section>
                <h2 className="text-tg-text font-semibold text-sm mb-3 uppercase tracking-wide text-tg-hint">
                  Разблокировано ({unlocked.length})
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {unlocked.map(a => (
                    <AchievementCard key={a.type} achievement={a} isUnlocked={true} />
                  ))}
                </div>
              </section>
            )}

            {/* Locked */}
            {locked.length > 0 && (
              <section>
                <h2 className="text-tg-text font-semibold text-sm mb-3 uppercase tracking-wide text-tg-hint">
                  Впереди ({locked.length})
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {locked.map(a => (
                    <AchievementCard key={a.type} achievement={a} isUnlocked={false} />
                  ))}
                </div>
              </section>
            )}

            {unlocked.length === 0 && locked.length === 0 && (
              <div className="text-center py-12 text-tg-hint">
                <div className="text-4xl mb-3">🏆</div>
                <p>Импортируй первую выписку, чтобы начать</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

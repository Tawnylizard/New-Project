import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { useAppStore } from '../store/useAppStore.js'
import { GoalCard } from '../components/GoalCard.js'
import { CreateGoalModal } from '../components/CreateGoalModal.js'
import { UpdateProgressModal } from '../components/UpdateProgressModal.js'
import type { FinancialGoal, GoalListResponse } from '@klyovo/shared'

type GoalFilter = 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'ALL'

const FILTER_LABELS: Array<{ value: GoalFilter; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'ACTIVE', label: 'В процессе' },
  { value: 'COMPLETED', label: 'Достигнуты' },
  { value: 'ABANDONED', label: 'Архив' }
]

export function Goals(): JSX.Element {
  const navigate = useNavigate()
  const { user } = useAppStore()
  const isPlusUser = user?.plan === 'PLUS'

  const [filter, setFilter] = useState<GoalFilter>('ACTIVE')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editGoal, setEditGoal] = useState<FinancialGoal | null>(null)

  const queryKey = filter === 'ALL' ? ['goals'] : ['goals', filter]
  const queryUrl = filter === 'ALL' ? '/goals' : `/goals?status=${filter}`

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => apiClient.get<GoalListResponse>(queryUrl).then(r => r.data)
  })

  const goals = data?.goals ?? []
  const activeCount = goals.filter(g => g.status === 'ACTIVE').length

  const canCreateGoal = isPlusUser || activeCount < 1

  return (
    <div className="min-h-screen bg-tg-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-tg-bg border-b border-tg-secondary px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-tg-hint text-xl"
            >
              ←
            </button>
            <div>
              <h1 className="font-bold text-tg-text">Мои цели</h1>
              {!isPlusUser && (
                <p className="text-xs text-tg-hint">{activeCount}/1 (бесплатный план)</p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (canCreateGoal) {
                setShowCreateModal(true)
              } else {
                navigate('/paywall')
              }
            }}
            className="bg-tg-button text-tg-button-text text-sm font-semibold px-4 py-2 rounded-xl"
          >
            + Цель
          </button>
        </div>
      </div>

      {/* PLUS upsell banner (FREE users) */}
      {!isPlusUser && (
        <div
          className="mx-4 mt-3 bg-gradient-to-r from-tg-button/20 to-purple-500/20 border border-tg-button/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer"
          onClick={() => navigate('/paywall')}
        >
          <div>
            <p className="text-sm font-semibold text-tg-text">Клёво Плюс</p>
            <p className="text-xs text-tg-hint">Неограниченные цели + AI-советы</p>
          </div>
          <div className="text-tg-button font-bold text-sm">₽199/мес →</div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar">
        {FILTER_LABELS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 text-sm px-4 py-1.5 rounded-full transition-colors ${
              filter === f.value
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-section text-tg-hint'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 mt-3 space-y-3">
        {isLoading && (
          <div className="text-center py-12 text-tg-hint">Загружаем цели...</div>
        )}

        {!isLoading && goals.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">🎯</p>
            <p className="text-tg-text font-medium">
              {filter === 'ACTIVE' ? 'Нет активных целей' : 'Ничего не найдено'}
            </p>
            <p className="text-tg-hint text-sm">
              {filter === 'ACTIVE'
                ? 'Создай первую цель и начни копить осознанно'
                : 'Измени фильтр или создай новую цель'}
            </p>
            {filter === 'ACTIVE' && (
              <button
                onClick={() => canCreateGoal ? setShowCreateModal(true) : navigate('/paywall')}
                className="bg-tg-button text-tg-button-text font-semibold px-6 py-3 rounded-2xl mt-2"
              >
                Создать цель
              </button>
            )}
          </div>
        )}

        {!isLoading && goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            isPlusUser={isPlusUser}
            onUpdate={() => refetch()}
            onOpenPaywall={() => navigate('/paywall')}
            onEditProgress={g => setEditGoal(g)}
          />
        ))}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateGoalModal onClose={() => { setShowCreateModal(false); refetch() }} />
      )}

      {editGoal && (
        <UpdateProgressModal
          goal={editGoal}
          onClose={() => { setEditGoal(null); refetch() }}
        />
      )}
    </div>
  )
}

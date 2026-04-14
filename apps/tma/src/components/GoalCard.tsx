import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { FinancialGoal, GoalAdviceResponse } from '@klyovo/shared'

interface GoalCardProps {
  goal: FinancialGoal
  isPlusUser: boolean
  onUpdate: () => void
  onOpenPaywall: () => void
  onEditProgress: (goal: FinancialGoal) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  SAVINGS: '💰 Накопления',
  EMERGENCY_FUND: '🛡 Подушка безопасности',
  VACATION: '✈️ Путешествие',
  GADGET: '📱 Гаджет',
  EDUCATION: '📚 Обучение',
  HOUSING: '🏠 Жильё',
  OTHER: '🎯 Другое'
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'В процессе',
  COMPLETED: '✅ Достигнута',
  ABANDONED: '⏸ Приостановлена'
}

function formatAmount(kopecks: number): string {
  const rubles = kopecks / 100
  if (rubles >= 1_000_000) return `₽${(rubles / 1_000_000).toFixed(1)}млн`
  if (rubles >= 1_000) return `₽${(rubles / 1_000).toFixed(0)}K`
  return `₽${rubles.toFixed(0)}`
}

function getDaysRemaining(deadline: Date | null): string | null {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'Просрочено'
  if (diff === 0) return 'Сегодня'
  return `${diff} дн.`
}

export function GoalCard({ goal, isPlusUser, onUpdate, onOpenPaywall, onEditProgress }: GoalCardProps): JSX.Element {
  const qc = useQueryClient()
  const [advice, setAdvice] = useState<string | null>(goal.aiAdvice)
  const [showAdvice, setShowAdvice] = useState(false)

  const progress = goal.targetAmountKopecks > 0
    ? Math.min(100, Math.round((goal.currentAmountKopecks / goal.targetAmountKopecks) * 100))
    : 0

  const daysRemaining = getDaysRemaining(goal.deadline)

  const abandonMutation = useMutation({
    mutationFn: () =>
      apiClient.put(`/goals/${goal.id}`, { status: 'ABANDONED' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      onUpdate()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiClient.delete(`/goals/${goal.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      onUpdate()
    }
  })

  const adviceMutation = useMutation({
    mutationFn: () =>
      apiClient.post<GoalAdviceResponse>(`/goals/${goal.id}/advice`).then(r => r.data),
    onSuccess: (data) => {
      setAdvice(data.advice)
      setShowAdvice(true)
    }
  })

  const handleAdviceClick = (): void => {
    if (!isPlusUser) {
      onOpenPaywall()
      return
    }
    if (advice) {
      setShowAdvice(v => !v)
    } else {
      adviceMutation.mutate()
    }
  }

  return (
    <div className="bg-tg-section rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-tg-hint">{CATEGORY_LABELS[goal.category] ?? goal.category}</p>
          <p className="font-semibold text-tg-text truncate">{goal.name}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
          goal.status === 'COMPLETED'
            ? 'bg-green-500/20 text-green-400'
            : goal.status === 'ABANDONED'
              ? 'bg-gray-500/20 text-gray-400'
              : 'bg-tg-button/20 text-tg-button'
        }`}>
          {STATUS_LABELS[goal.status] ?? goal.status}
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-tg-text font-medium">{formatAmount(goal.currentAmountKopecks)}</span>
          <span className="text-tg-hint">из {formatAmount(goal.targetAmountKopecks)}</span>
        </div>
        <div className="w-full bg-tg-secondary rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              goal.status === 'COMPLETED' ? 'bg-green-500' : 'bg-tg-button'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-tg-hint">
          <span>{progress}%</span>
          {daysRemaining && <span>{daysRemaining}</span>}
        </div>
      </div>

      {/* AI Advice */}
      {showAdvice && advice && (
        <div className="bg-tg-bg rounded-xl p-3 text-sm text-tg-text space-y-1">
          <p className="text-xs font-medium text-tg-button mb-1">AI-совет Клёво</p>
          <p className="whitespace-pre-wrap leading-relaxed">{advice}</p>
        </div>
      )}

      {/* Actions */}
      {goal.status === 'ACTIVE' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onEditProgress(goal)}
            className="flex-1 bg-tg-button text-tg-button-text text-sm font-medium py-2 rounded-xl"
          >
            Обновить прогресс
          </button>
          <button
            onClick={handleAdviceClick}
            disabled={adviceMutation.isPending}
            className="flex-1 bg-tg-section border border-tg-button text-tg-button text-sm font-medium py-2 rounded-xl relative"
          >
            {adviceMutation.isPending
              ? '...'
              : advice && showAdvice
                ? 'Скрыть совет'
                : isPlusUser
                  ? advice ? 'Показать совет' : 'AI-совет'
                  : '🔒 AI-совет'}
          </button>
        </div>
      )}

      {goal.status === 'ACTIVE' && (
        <div className="flex gap-2">
          <button
            onClick={() => abandonMutation.mutate()}
            disabled={abandonMutation.isPending}
            className="text-xs text-tg-hint py-1"
          >
            Приостановить
          </button>
          <span className="text-tg-hint text-xs">·</span>
          <button
            onClick={() => {
              if (window.confirm('Удалить цель навсегда?')) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
            className="text-xs text-red-400 py-1"
          >
            Удалить
          </button>
        </div>
      )}

      {(goal.status === 'COMPLETED' || goal.status === 'ABANDONED') && (
        <button
          onClick={() => {
            if (window.confirm('Удалить цель?')) {
              deleteMutation.mutate()
            }
          }}
          disabled={deleteMutation.isPending}
          className="text-xs text-red-400 py-1"
        >
          Удалить
        </button>
      )}
    </div>
  )
}

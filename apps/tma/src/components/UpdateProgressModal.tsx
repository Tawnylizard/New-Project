import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { FinancialGoal } from '@klyovo/shared'

interface UpdateProgressModalProps {
  goal: FinancialGoal
  onClose: () => void
}

export function UpdateProgressModal({ goal, onClose }: UpdateProgressModalProps): JSX.Element {
  const qc = useQueryClient()
  const [amountRub, setAmountRub] = useState(
    goal.currentAmountKopecks > 0 ? (goal.currentAmountKopecks / 100).toFixed(0) : ''
  )
  const [error, setError] = useState<string | null>(null)

  const targetRub = goal.targetAmountKopecks / 100
  const progress = goal.targetAmountKopecks > 0
    ? Math.min(100, Math.round((goal.currentAmountKopecks / goal.targetAmountKopecks) * 100))
    : 0

  const updateMutation = useMutation({
    mutationFn: (currentAmountKopecks: number) =>
      apiClient.put(`/goals/${goal.id}`, { currentAmountKopecks }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      onClose()
    },
    onError: () => {
      setError('Ошибка при сохранении. Попробуй ещё раз.')
    }
  })

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setError(null)

    const kopecks = Math.round(parseFloat(amountRub.replace(',', '.')) * 100)
    if (isNaN(kopecks) || kopecks < 0) {
      setError('Введи корректную сумму')
      return
    }

    updateMutation.mutate(kopecks)
  }

  const presets = [
    { label: '+₽500', delta: 50000 },
    { label: '+₽1K', delta: 100000 },
    { label: '+₽5K', delta: 500000 },
    { label: '+₽10K', delta: 1000000 }
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full bg-tg-bg rounded-t-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-tg-text">Обновить прогресс</h2>
          <button onClick={onClose} className="text-tg-hint text-2xl leading-none">×</button>
        </div>

        {/* Goal info */}
        <div className="bg-tg-section rounded-xl p-3">
          <p className="text-sm text-tg-text font-medium">{goal.name}</p>
          <div className="mt-2">
            <div className="w-full bg-tg-secondary rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-tg-button transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-tg-hint mt-1">{progress}% из ₽{targetRub.toFixed(0)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-tg-hint mb-1 block">Сколько накопил всего (₽)</label>
            <input
              type="number"
              value={amountRub}
              onChange={e => setAmountRub(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              autoFocus
              className="w-full bg-tg-section text-tg-text rounded-xl px-4 py-3 text-sm outline-none text-center text-2xl font-bold"
            />
          </div>

          {/* Quick add presets */}
          <div>
            <p className="text-xs text-tg-hint mb-2">Добавить к текущему</p>
            <div className="flex gap-2">
              {presets.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    const current = parseFloat(amountRub.replace(',', '.')) || (goal.currentAmountKopecks / 100)
                    setAmountRub((current + p.delta / 100).toFixed(0))
                  }}
                  className="flex-1 bg-tg-section text-tg-text text-xs py-2 rounded-xl border border-tg-secondary"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full bg-tg-button text-tg-button-text font-semibold py-3.5 rounded-2xl disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  )
}

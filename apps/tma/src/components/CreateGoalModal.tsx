import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { CreateGoalInput, GoalCategory } from '@klyovo/shared'

interface CreateGoalModalProps {
  onClose: () => void
}

const CATEGORIES: Array<{ value: GoalCategory; label: string }> = [
  { value: 'SAVINGS', label: '💰 Накопления' },
  { value: 'EMERGENCY_FUND', label: '🛡 Подушка безопасности' },
  { value: 'VACATION', label: '✈️ Путешествие' },
  { value: 'GADGET', label: '📱 Гаджет' },
  { value: 'EDUCATION', label: '📚 Обучение' },
  { value: 'HOUSING', label: '🏠 Жильё' },
  { value: 'OTHER', label: '🎯 Другое' }
]

export function CreateGoalModal({ onClose }: CreateGoalModalProps): JSX.Element {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<GoalCategory>('SAVINGS')
  const [targetRub, setTargetRub] = useState('')
  const [currentRub, setCurrentRub] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: CreateGoalInput) =>
      apiClient.post('/goals', input).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message
      if (msg?.includes('GOAL_LIMIT_REACHED')) {
        setError('Бесплатный план: максимум 1 цель. Оформи Клёво Плюс для неограниченных целей.')
      } else if (msg?.includes('INVALID_DEADLINE')) {
        setError('Дедлайн должен быть в будущем')
      } else {
        setError(msg ?? 'Ошибка при создании цели')
      }
    }
  })

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setError(null)

    const targetKopecks = Math.round(parseFloat(targetRub.replace(',', '.')) * 100)
    const currentKopecks = currentRub
      ? Math.round(parseFloat(currentRub.replace(',', '.')) * 100)
      : 0

    if (!name.trim()) { setError('Укажи название цели'); return }
    if (isNaN(targetKopecks) || targetKopecks <= 0) { setError('Укажи корректную целевую сумму'); return }

    createMutation.mutate({
      name: name.trim(),
      category,
      targetAmountKopecks: targetKopecks,
      currentAmountKopecks: currentKopecks,
      deadline: deadline ? new Date(deadline).toISOString() : null
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full bg-tg-bg rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-tg-text">Новая цель</h2>
          <button onClick={onClose} className="text-tg-hint text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-tg-hint mb-1 block">Название</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Отпуск в Турции"
              maxLength={100}
              className="w-full bg-tg-section text-tg-text rounded-xl px-4 py-3 text-sm outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-tg-hint mb-1 block">Категория</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`text-left text-sm px-3 py-2 rounded-xl border transition-colors ${
                    category === c.value
                      ? 'border-tg-button bg-tg-button/10 text-tg-button'
                      : 'border-tg-secondary text-tg-text'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target amount */}
          <div>
            <label className="text-xs text-tg-hint mb-1 block">Целевая сумма (₽)</label>
            <input
              type="number"
              value={targetRub}
              onChange={e => setTargetRub(e.target.value)}
              placeholder="50000"
              min="1"
              step="1"
              className="w-full bg-tg-section text-tg-text rounded-xl px-4 py-3 text-sm outline-none"
            />
          </div>

          {/* Current amount */}
          <div>
            <label className="text-xs text-tg-hint mb-1 block">Уже накоплено (₽, необязательно)</label>
            <input
              type="number"
              value={currentRub}
              onChange={e => setCurrentRub(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className="w-full bg-tg-section text-tg-text rounded-xl px-4 py-3 text-sm outline-none"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="text-xs text-tg-hint mb-1 block">Дедлайн (необязательно)</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-tg-section text-tg-text rounded-xl px-4 py-3 text-sm outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full bg-tg-button text-tg-button-text font-semibold py-3.5 rounded-2xl disabled:opacity-50"
          >
            {createMutation.isPending ? 'Создаём...' : 'Создать цель'}
          </button>
        </form>
      </div>
    </div>
  )
}

import type { BnplListResponse } from '@klyovo/shared'

type BnplObligationWithRemaining = BnplListResponse['obligations'][number]

interface BnplCardProps {
  obligation: BnplObligationWithRemaining
  onDismiss: (id: string) => void
  onRestore: (id: string) => void
  isPending: boolean
}

const SERVICE_EMOJI: Record<string, string> = {
  'Долями': '🟡',
  'Сплит': '🟢',
  'Подели': '🟢',
  'Яндекс Сплит': '🔵'
}

export function BnplCard({ obligation: ob, onDismiss, onRestore, isPending }: BnplCardProps): JSX.Element {
  const emoji = SERVICE_EMOJI[ob.bnplService] ?? '💳'
  const progress = ob.paidInstallments / ob.totalInstallments
  const progressPercent = Math.min(100, Math.round(progress * 100))
  const isDismissed = ob.status === 'dismissed'
  const isOverdue = ob.status === 'overdue'
  const isCompleted = ob.status === 'completed'

  const formattedNext = ob.nextPaymentDate
    ? new Date(ob.nextPaymentDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : null

  return (
    <div
      className={`bg-tg-secondary rounded-2xl p-4 space-y-3 transition-opacity ${isDismissed ? 'opacity-50' : ''}`}
    >
      {/* Top row: service + merchant + amount */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span>{emoji}</span>
            <span className="text-xs text-tg-hint">{ob.bnplService}</span>
            {isOverdue && <span className="text-xs text-red-500 font-medium">просрочено</span>}
            {isCompleted && <span className="text-xs text-green-600 font-medium">выплачено</span>}
          </div>
          <p className="font-semibold text-tg-text text-base">
            {ob.merchantDisplay || ob.merchantName}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-tg-text">
            ₽{(ob.installmentAmount / 100).toFixed(0)}
          </p>
          <p className="text-xs text-tg-hint">за раз</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-tg-hint">
          <span>{ob.paidInstallments} из {ob.totalInstallments} платежей</span>
          <span>осталось ₽{(ob.remainingAmount / 100).toFixed(0)}</span>
        </div>
        <div className="h-2 bg-tg-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isCompleted ? 'bg-green-400' : isOverdue ? 'bg-red-400' : 'bg-tg-button'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Next payment */}
      {formattedNext && !isCompleted && (
        <p className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-tg-hint'}`}>
          {isOverdue ? '⚠️ ' : '📅 '}
          Следующий платёж: {formattedNext}
        </p>
      )}

      {/* Actions */}
      {!isCompleted && (
        <div className="flex gap-2">
          {isDismissed ? (
            <button
              onClick={() => onRestore(ob.id)}
              disabled={isPending}
              className="flex-1 bg-tg-bg text-tg-text text-xs font-medium py-2 rounded-xl border border-tg-secondary disabled:opacity-50"
            >
              Восстановить
            </button>
          ) : (
            <button
              onClick={() => onDismiss(ob.id)}
              disabled={isPending}
              className="flex-1 bg-tg-bg text-tg-hint text-xs font-medium py-2 rounded-xl border border-tg-secondary disabled:opacity-50"
            >
              Скрыть
            </button>
          )}
        </div>
      )}
    </div>
  )
}

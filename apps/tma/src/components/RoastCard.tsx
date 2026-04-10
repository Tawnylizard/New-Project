import type { GenerateRoastResponse } from '@klyovo/shared'

interface RoastCardProps {
  roast: GenerateRoastResponse
  onShare: () => void
  onNew: () => void
}

export function RoastCard({ roast, onShare, onNew }: RoastCardProps): JSX.Element {
  const { roastText, spendingSummary } = roast

  return (
    <div className="space-y-4">
      {/* Roast text */}
      <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-5">
        <p className="text-tg-text leading-relaxed whitespace-pre-wrap">{roastText}</p>
      </div>

      {/* Spending summary */}
      <div className="bg-tg-secondary rounded-2xl p-4 space-y-2">
        <p className="text-xs font-medium text-tg-hint uppercase tracking-wide">Итоги</p>
        <div className="flex justify-between">
          <span className="text-sm text-tg-hint">Всего потрачено</span>
          <span className="text-sm font-bold text-tg-text">
            ₽{(spendingSummary.totalAmount / 100).toFixed(0)}
          </span>
        </div>
        {spendingSummary.bnplTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-tg-hint">BNPL-долги</span>
            <span className="text-sm font-bold text-orange-500">
              ₽{(spendingSummary.bnplTotal / 100).toFixed(0)}
            </span>
          </div>
        )}
        {spendingSummary.subscriptionsFound > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-tg-hint">Подписок найдено</span>
            <span className="text-sm font-bold text-red-500">{spendingSummary.subscriptionsFound}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={onShare}
          className="w-full bg-tg-button text-tg-button-text font-semibold py-3 px-6 rounded-2xl"
        >
          📤 Поделиться в Telegram
        </button>
        <button
          onClick={onNew}
          className="w-full bg-tg-secondary text-tg-text font-semibold py-3 px-6 rounded-2xl"
        >
          🔄 Ещё один roast
        </button>
      </div>

      <p className="text-xs text-tg-hint text-center">
        Это информационный сервис, не финансовый советник
      </p>
    </div>
  )
}

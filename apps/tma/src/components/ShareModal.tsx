import { useState } from 'react'
import type { GenerateRoastResponse, TransactionCategory } from '@klyovo/shared'
import { apiClient } from '../api/client.js'
import { useReferralStats } from '../hooks/useReferralStats.js'
import { ReferralStats } from './ReferralStats.js'

interface ShareModalProps {
  roast: GenerateRoastResponse
  onClose: () => void
}

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  FOOD_CAFE: 'Кафе и рестораны',
  GROCERIES: 'Продукты',
  MARKETPLACE: 'Маркетплейсы',
  TRANSPORT: 'Транспорт',
  SUBSCRIPTIONS: 'Подписки',
  ENTERTAINMENT: 'Развлечения',
  HEALTH: 'Здоровье',
  CLOTHING: 'Одежда',
  EDUCATION: 'Образование',
  OTHER: 'Прочее'
}

function buildShareText(roast: GenerateRoastResponse, referralLink: string): string {
  const excerpt =
    roast.roastText.length > 120
      ? roast.roastText.slice(0, 120) + '...'
      : roast.roastText

  const totalRub = Math.round(roast.spendingSummary.totalAmount / 100).toLocaleString('ru-RU')
  const topCat = roast.spendingSummary.topCategories[0]

  const topSpendLine = topCat
    ? `\nТоп расход: ${CATEGORY_LABELS[topCat.category]} — ₽${Math.round(topCat.amount / 100).toLocaleString('ru-RU')}`
    : ''

  return [
    '🔥 Клёво разнесло мои траты в пух и прах!',
    '',
    `«${excerpt}»`,
    topSpendLine,
    `Всего за месяц: ₽${totalRub}`,
    '',
    `👉 Попробуй сам: ${referralLink}`
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function ShareModal({ roast, onClose }: ShareModalProps): JSX.Element {
  const { data: referralStats, isLoading } = useReferralStats()
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string): void => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleSendToFriend = async (): Promise<void> => {
    if (!referralStats) return

    // Record the share event (best-effort)
    apiClient.post(`/roast/${roast.roastId}/share`).catch(() => {})

    const shareText = buildShareText(roast, referralStats.referralLink)
    const shareUrl =
      `tg://msg_url?url=${encodeURIComponent(referralStats.referralLink)}` +
      `&text=${encodeURIComponent(shareText)}`

    try {
      window.Telegram?.WebApp?.openTelegramLink(shareUrl)
    } catch {
      try {
        window.open(shareUrl, '_blank')
      } catch {
        // Both failed — modal stays open, user can use copy button
      }
    }
  }

  const handleCopyLink = async (): Promise<void> => {
    if (!referralStats) return
    try {
      await navigator.clipboard.writeText(referralStats.referralLink)
      showToast('Ссылка скопирована!')
    } catch {
      showToast(`Ссылка: ${referralStats.referralLink}`)
    }
  }

  const topCat = roast.spendingSummary.topCategories[0]
  const excerpt =
    roast.roastText.length > 120
      ? roast.roastText.slice(0, 120) + '...'
      : roast.roastText

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-tg-bg w-full rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-tg-text">🔥 Поделись ростом!</h2>
          <button
            onClick={onClose}
            className="text-tg-hint text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Preview card */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-4 space-y-2">
          <p className="text-sm text-tg-text leading-relaxed">«{excerpt}»</p>
          {topCat && (
            <p className="text-xs text-tg-hint">
              Топ: {CATEGORY_LABELS[topCat.category]} —{' '}
              ₽{Math.round(topCat.amount / 100).toLocaleString('ru-RU')}
            </p>
          )}
          <p className="text-xs font-semibold text-orange-500">Клёво — AI финансы 🚀</p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleSendToFriend}
            disabled={isLoading || !referralStats}
            className="w-full bg-tg-button text-tg-button-text font-semibold py-3 px-6 rounded-2xl disabled:opacity-50"
          >
            📤 Отправить другу
          </button>
          <button
            onClick={handleCopyLink}
            disabled={isLoading || !referralStats}
            className="w-full bg-tg-secondary text-tg-text font-semibold py-3 px-6 rounded-2xl disabled:opacity-50"
          >
            🔗 Скопировать ссылку
          </button>
        </div>

        {/* Referral stats */}
        {referralStats && (
          <ReferralStats
            referralCode={referralStats.referralCode}
            invitedCount={referralStats.invitedCount}
            activeCount={referralStats.activeCount}
          />
        )}

        {/* Toast */}
        {toast && (
          <div className="bg-tg-text text-tg-bg text-sm text-center py-2 px-4 rounded-xl">
            {toast}
          </div>
        )}

        <p className="text-xs text-tg-hint text-center">
          Это информационный сервис, не финансовый советник
        </p>
      </div>
    </div>
  )
}

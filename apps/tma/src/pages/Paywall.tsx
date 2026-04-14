import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import type { CheckoutResponse, KlyovoSubscriptionPlan, SubscriptionStatusResponse } from '@klyovo/shared'
import { PLUS_MONTHLY_PRICE_KOPECKS, PLUS_YEARLY_PRICE_KOPECKS } from '@klyovo/shared'

const FEATURES = [
  '🔥 Безлимитный Жёсткий режим',
  '📊 История за любой период',
  '🎯 Финансовые цели',
  '💾 Автосбережения',
  '📈 Еженедельные отчёты'
]

export function Paywall(): JSX.Element {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState<KlyovoSubscriptionPlan>('plus_monthly')

  const { data: subStatus, isLoading: statusLoading } = useQuery<SubscriptionStatusResponse>({
    queryKey: ['subscription-status'],
    queryFn: () => apiClient.get<SubscriptionStatusResponse>('/subscriptions/status').then(r => r.data),
    staleTime: 60_000
  })

  const checkout = useMutation({
    mutationFn: (plan: KlyovoSubscriptionPlan) =>
      apiClient
        .post<CheckoutResponse>('/subscriptions/checkout', {
          plan,
          returnUrl: `https://t.me/${import.meta.env['VITE_BOT_USERNAME'] ?? 'klyovobot'}`
        })
        .then(r => r.data),
    onSuccess: data => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(data.confirmationUrl)
      } else {
        window.location.href = data.confirmationUrl
      }
    }
  })

  const handleBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tg-bg">
        <p className="text-tg-hint text-sm">Загрузка...</p>
      </div>
    )
  }

  if (subStatus?.isActive) {
    const expiresAt = subStatus.planExpiresAt
      ? new Date(subStatus.planExpiresAt).toLocaleDateString('ru-RU')
      : null
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-tg-bg space-y-4">
        <div className="text-5xl">⭐️</div>
        <h2 className="text-xl font-bold text-tg-text">Клёво Плюс активен</h2>
        {expiresAt && (
          <p className="text-tg-hint text-sm">Действует до {expiresAt}</p>
        )}
        <button onClick={handleBack} className="text-tg-button text-sm font-medium">
          Назад
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-tg-bg p-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="text-5xl">⭐️</div>
        <h1 className="text-2xl font-bold text-tg-text">Клёво Плюс</h1>
        <p className="text-tg-hint text-sm">Полный контроль над финансами</p>
      </div>

      {/* Features */}
      <div className="bg-tg-secondary rounded-2xl p-4 space-y-3">
        {FEATURES.map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-base">{f.split(' ')[0]}</span>
            <span className="text-sm text-tg-text">{f.slice(f.indexOf(' ') + 1)}</span>
          </div>
        ))}
      </div>

      {/* Plan selector */}
      <div className="space-y-2">
        {([
          { plan: 'plus_monthly' as const, label: '₽199 / месяц', badge: null },
          {
            plan: 'plus_yearly' as const,
            label: '₽1490 / год',
            badge: 'Скидка 38%'
          }
        ]).map(({ plan, label, badge }) => (
          <button
            key={plan}
            onClick={() => setSelectedPlan(plan)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${
              selectedPlan === plan
                ? 'border-tg-button bg-tg-button/10'
                : 'border-tg-secondary bg-tg-secondary'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 ${
                  selectedPlan === plan ? 'border-tg-button bg-tg-button' : 'border-tg-hint'
                }`}
              />
              <span className="font-medium text-tg-text">{label}</span>
            </div>
            {badge && (
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-lg">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {checkout.error && (
        <p className="text-red-500 text-sm text-center">Оплата не прошла. Попробуй ещё раз.</p>
      )}

      <button
        onClick={() => checkout.mutate(selectedPlan)}
        disabled={checkout.isPending}
        className="w-full bg-tg-button text-tg-button-text font-bold py-4 px-6 rounded-2xl disabled:opacity-50"
      >
        {checkout.isPending
          ? 'Открываю оплату...'
          : `Оплатить через СБП / МИР — ₽${selectedPlan === 'plus_monthly' ? (PLUS_MONTHLY_PRICE_KOPECKS / 100) : (PLUS_YEARLY_PRICE_KOPECKS / 100)}`}
      </button>

      <button
        onClick={handleBack}
        className="w-full text-tg-hint text-sm py-2"
      >
        Назад
      </button>

      <p className="text-xs text-tg-hint text-center">
        Это информационный сервис, не финансовый советник
      </p>
    </div>
  )
}

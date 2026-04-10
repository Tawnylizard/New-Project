import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { CheckoutResponse, KlyovoSubscriptionPlan } from '@klyovo/shared'
import { PLUS_MONTHLY_PRICE_KOPECKS } from '@klyovo/shared'

interface PaymentWidgetProps {
  plan?: KlyovoSubscriptionPlan
  onSuccess?: () => void
}

export function PaymentWidget({
  plan = 'plus_monthly',
  onSuccess
}: PaymentWidgetProps): JSX.Element {
  const mutation = useMutation({
    mutationFn: () =>
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
      onSuccess?.()
    }
  })

  return (
    <div className="space-y-2">
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full bg-tg-button text-tg-button-text font-bold py-3 px-6 rounded-2xl disabled:opacity-50"
      >
        {mutation.isPending
          ? '...'
          : `Оплатить ₽${(PLUS_MONTHLY_PRICE_KOPECKS / 100)} через СБП/МИР`}
      </button>
      {mutation.error && (
        <p className="text-red-500 text-xs text-center">Ошибка оплаты. Попробуй ещё раз.</p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import { useAppStore } from '../store/useAppStore.js'
import { RoastCard } from '../components/RoastCard.js'
import { ShareModal } from '../components/ShareModal.js'
import type { GenerateRoastResponse, RoastMode as RoastModeType } from '@klyovo/shared'

export function RoastMode(): JSX.Element {
  const { user } = useAppStore()
  const [mode, setMode] = useState<RoastModeType>('harsh')
  const [roast, setRoast] = useState<GenerateRoastResponse | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      apiClient
        .post<GenerateRoastResponse>('/roast/generate', { mode, periodDays: 30 })
        .then(r => r.data),
    onSuccess: data => setRoast(data)
  })

  const handleShare = (): void => {
    setShowShareModal(true)
  }

  if (mutation.error) {
    const err = mutation.error as { response?: { data?: { error?: { code?: string } } } }
    if (err.response?.data?.error?.code === 'PLAN_LIMIT') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-tg-bg">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-5xl">🔒</p>
            <h2 className="text-xl font-bold text-tg-text">Лимит исчерпан</h2>
            <p className="text-tg-hint text-sm">
              3 roast в месяц — бесплатно. Безлимит — в Клёво Плюс
            </p>
            <a
              href="/paywall"
              className="block bg-tg-button text-tg-button-text font-semibold py-3 px-6 rounded-2xl"
            >
              Клёво Плюс ₽199/мес
            </a>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-tg-bg p-4 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-tg-text">🔥 Жёсткий режим</h1>
        <p className="text-tg-hint text-sm">AI разберёт твои траты без жалости</p>
        {user?.plan === 'FREE' && (
          <p className="text-xs text-orange-500">3 roast/мес на бесплатном плане</p>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 bg-tg-secondary rounded-2xl p-1">
        {(['harsh', 'soft'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-tg-button text-tg-button-text'
                : 'text-tg-hint'
            }`}
          >
            {m === 'harsh' ? '🔥 Жёстко' : '💙 Мягко'}
          </button>
        ))}
      </div>

      {roast ? (
        <RoastCard roast={roast} onShare={handleShare} onNew={() => { setRoast(null); mutation.reset() }} />
      ) : (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-5 px-6 rounded-2xl text-xl disabled:opacity-60"
        >
          {mutation.isPending ? '⏳ Анализирую...' : '🔥 Разнеси мои траты'}
        </button>
      )}

      <p className="text-xs text-tg-hint text-center">
        Это информационный сервис, не финансовый советник
      </p>

      {showShareModal && roast && (
        <ShareModal roast={roast} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { useAppStore } from '../store/useAppStore.js'
import type { AuthTelegramResponse } from '@klyovo/shared'

const STEPS = ['Привет!', 'Как это работает', 'Загрузи выписку', 'Готово!']

export function Onboarding(): JSX.Element {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setAuth } = useAppStore()

  const handleAuth = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const initData = window.Telegram?.WebApp?.initData ?? ''
      const res = await apiClient.post<AuthTelegramResponse>('/auth/telegram', { initData })
      setAuth(res.data.token, res.data.user)
      navigate('/dashboard')
    } catch {
      setError('Сессия истекла. Открой бота заново.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-6 bg-tg-bg">
      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-tg-button' : 'bg-tg-secondary'}`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-6">
        {step === 0 && (
          <>
            <div className="text-center space-y-3">
              <div className="text-5xl">👋</div>
              <h2 className="text-2xl font-bold text-tg-text">Привет!</h2>
              <p className="text-tg-hint">
                Клёво — твой личный финансовый ИИ. Честный и без прикрас.
              </p>
            </div>
            <div className="bg-tg-secondary rounded-2xl p-4">
              <p className="text-sm text-tg-hint">
                ✅ Данные хранятся только в России (ФЗ-152)<br />
                ✅ Выписки удаляются сразу после анализа<br />
                ✅ Это информационный сервис, не банк
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="text-center space-y-3">
              <div className="text-5xl">🤖</div>
              <h2 className="text-2xl font-bold text-tg-text">Как это работает</h2>
            </div>
            <div className="space-y-3">
              {['Загружаешь выписку из банка', 'AI анализирует твои траты', 'Получаешь честный разбор 🔥'].map(
                (text, i) => (
                  <div key={i} className="flex items-center gap-3 bg-tg-secondary rounded-xl p-3">
                    <span className="text-tg-button font-bold">{i + 1}</span>
                    <span className="text-sm text-tg-text">{text}</span>
                  </div>
                )
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center space-y-3">
              <div className="text-5xl">📊</div>
              <h2 className="text-2xl font-bold text-tg-text">Загрузи выписку</h2>
              <p className="text-tg-hint text-sm">
                Поддерживаем Сбербанк и Т-Банк. Файл удаляется после парсинга.
              </p>
            </div>
            <div className="bg-tg-secondary rounded-2xl p-4 space-y-2">
              <p className="text-sm font-medium text-tg-text">Как скачать выписку:</p>
              <p className="text-xs text-tg-hint">Сбер: Главная → История → Экспорт → CSV</p>
              <p className="text-xs text-tg-hint">Т-Банк: Счета → Выписка → CSV</p>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-center space-y-3">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-tg-text">Всё готово!</h2>
              <p className="text-tg-hint">Войди через Telegram и начни анализ</p>
            </div>
            {error && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>
            )}
          </>
        )}
      </div>

      <div className="space-y-3 mt-8">
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="w-full bg-tg-button text-tg-button-text font-semibold py-3 px-6 rounded-2xl"
          >
            Далее
          </button>
        ) : (
          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-tg-button text-tg-button-text font-semibold py-3 px-6 rounded-2xl disabled:opacity-50"
          >
            {loading ? 'Входим...' : 'Войти через Telegram'}
          </button>
        )}
      </div>
    </div>
  )
}

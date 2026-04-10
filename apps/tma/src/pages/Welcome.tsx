import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DEMO_ROASTS = [
  '₽12 400 на Яндекс Еду за месяц? Это 413 рублей каждый день. Ты буквально платишь за то, чтобы не готовить. Уважаю хаотичность, но не кошелёк.',
  'Wildberries списал ₽9 800. Три «нужных» покупки, которые сейчас пылятся в углу. Маркетплейс знает тебя лучше, чем ты сам.',
  'Подписки на ₽4 200 в месяц. Яндекс Плюс, Netflix, что-то ещё... Ты помнишь хотя бы три из них? Потому что они точно помнят твою карту.'
]

export function Welcome(): JSX.Element {
  const navigate = useNavigate()
  const [showDemo, setShowDemo] = useState(false)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-tg-bg">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="text-6xl">🔥</div>
          <h1 className="text-3xl font-bold text-tg-text">Клёво</h1>
          <p className="text-tg-hint text-sm">
            AI-финансист с характером. Расскажет правду о твоих тратах.
          </p>
        </div>

        {!showDemo ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowDemo(true)}
              className="w-full bg-tg-button text-tg-button-text font-semibold py-3 px-6 rounded-2xl"
            >
              Попробовать демо
            </button>
            <button
              onClick={() => navigate('/onboarding')}
              className="w-full border border-tg-hint text-tg-text font-semibold py-3 px-6 rounded-2xl"
            >
              Войти через Telegram
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {DEMO_ROASTS.map((roast, i) => (
              <div key={i} className="bg-tg-secondary rounded-2xl p-4">
                <p className="text-tg-text text-sm leading-relaxed">{roast}</p>
              </div>
            ))}
            <p className="text-xs text-tg-hint text-center">
              Это информационный сервис, не финансовый советник
            </p>
            <button
              onClick={() => navigate('/onboarding')}
              className="w-full bg-tg-button text-tg-button-text font-semibold py-3 px-6 rounded-2xl"
            >
              Загрузи свои траты 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

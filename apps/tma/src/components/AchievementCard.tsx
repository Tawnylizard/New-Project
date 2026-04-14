import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { AchievementMeta, UnlockedAchievement, ShareAchievementResponse } from '@klyovo/shared'

interface AchievementCardProps {
  achievement: AchievementMeta | UnlockedAchievement
  isUnlocked: boolean
}

function isUnlockedAchievement(a: AchievementMeta | UnlockedAchievement): a is UnlockedAchievement {
  return 'unlockedAt' in a
}

export function AchievementCard({ achievement, isUnlocked }: AchievementCardProps): JSX.Element {
  const shareMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post<ShareAchievementResponse>('/streaks/share', { achievementType: achievement.type })
        .then(r => r.data),
    onSuccess: (data) => {
      const tg = (window as { Telegram?: { WebApp?: { shareMessage?: (text: string) => void } } }).Telegram?.WebApp
      if (tg?.shareMessage) {
        tg.shareMessage(data.shareText)
      } else {
        // Fallback for browser dev mode
        navigator.clipboard.writeText(data.shareText).catch(() => null)
      }
    }
  })

  const unlockedDate = isUnlocked && isUnlockedAchievement(achievement)
    ? new Date(achievement.unlockedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : null

  return (
    <div
      className={`
        relative rounded-2xl p-4 border transition-all
        ${isUnlocked
          ? 'bg-tg-button/10 border-tg-button/30'
          : 'bg-tg-secondary/30 border-tg-secondary/20 opacity-50'
        }
      `}
    >
      {/* Emoji */}
      <div className={`text-3xl mb-2 ${isUnlocked ? '' : 'grayscale'}`}>
        {isUnlocked ? achievement.emoji : '🔒'}
      </div>

      {/* Name */}
      <div className="font-semibold text-tg-text text-sm leading-tight mb-1">
        {achievement.name}
      </div>

      {/* Description */}
      <div className="text-tg-hint text-xs leading-tight mb-3">
        {achievement.description}
      </div>

      {/* Footer */}
      {isUnlocked ? (
        <div className="flex items-center justify-between">
          <span className="text-tg-hint text-xs">{unlockedDate}</span>
          <button
            onClick={() => shareMutation.mutate()}
            disabled={shareMutation.isPending}
            className="text-xs text-tg-button font-medium active:opacity-70 disabled:opacity-40"
          >
            {shareMutation.isPending ? '...' : 'Поделиться'}
          </button>
        </div>
      ) : (
        <div className="text-tg-hint text-xs">Не разблокирована</div>
      )}
    </div>
  )
}

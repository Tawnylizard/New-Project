interface ReferralStatsProps {
  referralCode: string
  invitedCount: number
  activeCount: number
}

export function ReferralStats({ referralCode, invitedCount, activeCount }: ReferralStatsProps): JSX.Element {
  return (
    <div className="bg-tg-secondary rounded-xl p-3 space-y-1 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-tg-hint">Приглашено</span>
        <span className="font-semibold text-tg-text">👥 {invitedCount} чел.</span>
      </div>
      {activeCount > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-tg-hint">Активных</span>
          <span className="font-semibold text-green-500">✅ {activeCount}</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <span className="text-tg-hint">Твой код</span>
        <span className="font-mono text-xs text-tg-hint">{referralCode}</span>
      </div>
    </div>
  )
}
